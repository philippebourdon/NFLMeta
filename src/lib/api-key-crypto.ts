import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * At-rest encryption for `api_keys.key_encrypted`.
 *
 * The column has always been named `key_encrypted` and has never been
 * encrypted: it held each customer's full, usable `NFLMeta_<48 hex>` secret in
 * plaintext, so `sha256(key_encrypted) = key_hash` held for every row. Any
 * single read of the app database -- a backup, a dump, a psql session, one
 * leaked connection string -- handed over every live customer key.
 *
 * This module makes the column's name true.
 *
 * WHAT THIS IS NOT FOR
 * --------------------
 * Authentication does not go through here and must never be made to. A
 * presented key is verified in api-key.ts by hashing it and comparing the
 * digest against `key_hash` in constant time; `key_encrypted` is not even
 * SELECTed on that path. The column exists purely so the customer portal and
 * the admin key table can re-display a key the customer already holds.
 *
 * That separation is the safety property of this change, and it is what lets
 * the failure modes below be as blunt as they are: nothing in this file can
 * reject a customer's API request, because nothing in this file runs while one
 * is being served.
 *
 * ENVELOPE FORMAT
 * ---------------
 *   v1:<iv>:<tag>:<ciphertext>      (each component base64)
 *
 * AES-256-GCM, 12-byte random IV per encryption, 16-byte auth tag. The version
 * prefix is what makes a future scheme change unambiguous rather than a
 * guessing game: a v2 reader keeps decoding v1 rows while it re-wraps them.
 *
 * GCM rather than CBC because the tag makes tampering an error instead of
 * garbage. A modified ciphertext must not decrypt to a plausible-looking string
 * that we then hand to a customer as their API key.
 */

const ENVELOPE_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Name of the environment variable holding the 32-byte master key, base64.
 *
 * Generate one with:
 *   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
 *
 * This value must be present in the environment BEFORE any code that encrypts
 * is deployed, and it must be identical anywhere the same database is read
 * from. Rotating it without re-wrapping the stored rows makes every existing
 * row undecryptable -- see the note on rotation at the bottom of this file.
 */
export const API_KEY_ENCRYPTION_ENV_VAR = "NFLMETA_API_KEY_ENCRYPTION_KEY";

export class ApiKeyEncryptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyEncryptionUnavailableError";
  }
}

/**
 * Resolve the master key, or null when it is not usable.
 *
 * Deliberately not memoized against a null result: an operator who fixes the
 * environment variable and restarts gets a working process, and a process that
 * happened to start during a bad config does not stay poisoned.
 */
function resolveMasterKey(): Buffer | null {
  const configured = process.env[API_KEY_ENCRYPTION_ENV_VAR]?.trim();
  if (!configured) return null;

  let decoded: Buffer;
  try {
    decoded = Buffer.from(configured, "base64");
  } catch {
    return null;
  }

  // Buffer.from(..., "base64") does not throw on junk input, it silently drops
  // characters it cannot decode. The length check is therefore the real
  // validation, not a formality: it is what catches a truncated paste or a
  // hex-encoded value pasted where base64 was expected.
  if (decoded.length !== KEY_BYTES) return null;

  return decoded;
}

/** Whether at-rest encryption is configured and usable in this process. */
export function isApiKeyEncryptionConfigured(): boolean {
  return resolveMasterKey() !== null;
}

/**
 * Does this stored value carry our envelope?
 *
 * Cheap and total, because it is the entire backwards-compatibility mechanism:
 * un-migrated rows hold `NFLMeta_<48 hex>`, which contains no colon and cannot
 * collide with a `v1:`-prefixed envelope.
 */
export function isEncryptedApiKeyEnvelope(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  return parts.length === 4 && parts[0] === ENVELOPE_VERSION;
}

/**
 * Wrap a plaintext API key for storage.
 *
 * Throws when the master key is missing or malformed. This is the loud half of
 * the failure policy and it is deliberate: the alternative -- falling back to
 * writing plaintext -- would silently recreate the exact defect this module
 * exists to fix, and would do so invisibly, on new customers, for as long as
 * the misconfiguration lasted. A key that fails to mint is an error somebody
 * sees and fixes; a key quietly stored in the clear is one nobody ever notices.
 *
 * Callers on the key-creation path should let this propagate.
 */
export function encryptApiKey(plaintext: string): string {
  const masterKey = resolveMasterKey();
  if (!masterKey) {
    throw new ApiKeyEncryptionUnavailableError(
      `${API_KEY_ENCRYPTION_ENV_VAR} is not set to a valid 32-byte base64 value, so a new API key cannot be `
      + "stored safely. Refusing to write the key in plaintext. Set the variable and retry.",
    );
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

let decryptFailureLogged = false;

/**
 * Unwrap a stored value for display.
 *
 * Three cases, in order:
 *
 *  1. The value is not an envelope. It is an un-migrated plaintext row, so it
 *     is returned unchanged. This is what keeps the portal working in the
 *     window between deploying this code and running the migration, and it is
 *     why the deploy and the migration do not have to be simultaneous.
 *
 *  2. The value is an envelope and decryption succeeds. Return the key.
 *
 *  3. The value is an envelope and decryption fails -- missing master key,
 *     wrong master key, or a tampered/corrupted row. Return null.
 *
 * Case 3 returns null rather than throwing, which is the quiet half of the
 * failure policy. The caller renders a portal page carrying usage, billing and
 * subscription state; throwing would take that entire page down over one field.
 * Null degrades to "key unavailable" in the one box that needs it, and the
 * error is logged. Note the asymmetry with encryptApiKey is intentional:
 * refusing to write is safe, refusing to read is merely unhelpful.
 *
 * Nothing here can return a wrong key. GCM's tag turns a tampered ciphertext
 * into a thrown error inside `final()`, so the failure is null, never garbage.
 */
export function decryptApiKey(stored: string | null | undefined): string | null {
  if (!stored) return null;

  // Backwards compatibility: pre-migration rows are plaintext.
  if (!isEncryptedApiKeyEnvelope(stored)) return stored;

  const masterKey = resolveMasterKey();
  if (!masterKey) {
    if (!decryptFailureLogged) {
      decryptFailureLogged = true;
      console.error(
        `${API_KEY_ENCRYPTION_ENV_VAR} is not set to a valid 32-byte base64 value, but stored API keys are `
        + "encrypted. Keys cannot be displayed until it is restored. Authentication is unaffected: it reads "
        + "key_hash, not key_encrypted.",
      );
    }
    return null;
  }

  const [, ivB64, tagB64, ciphertextB64] = stored.split(":");

  try {
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    if (iv.length !== IV_BYTES || tag.length !== 16) return null;

    const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    // Never log the stored value or the master key -- only that it failed.
    console.error("Failed to decrypt a stored API key", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * ROTATION
 *
 * Changing the master key means re-wrapping every row, not just swapping the
 * variable: v1 rows are decryptable only by the key that wrote them. The
 * supported route is to add a v2 envelope that carries a key identifier, let
 * readers accept both, re-wrap in the background, then retire v1. The version
 * prefix above is what makes that possible without having to guess at a row's
 * provenance, which is the whole reason it is there.
 */
