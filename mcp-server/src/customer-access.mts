import { createDecipheriv } from "node:crypto";

import { Pool } from "pg";
import type { QueryResultRow } from "pg";

export type McpBillingPlan = "free" | "builder" | "pro" | "team";

export interface McpCustomerAccess {
  userId: number;
  clerkUserId: string;
  email: string;
  plan: Exclude<McpBillingPlan, "free">;
  apiKeyId: number;
  apiKey: string;
}

export interface McpCustomerAccessRow extends QueryResultRow {
  user_id: number | string;
  clerk_user_id: string;
  email: string;
  api_key_id: number | string | null;
  key_encrypted: string | null;
  api_key_plan: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  stripe_status: string | null;
  cancel_at_period_end: boolean | null;
  manual_access_expires_at: Date | string | null;
  last_invoice_status: string | null;
  past_due_grace_expires_at: Date | string | null;
}

export class McpCustomerAccessError extends Error {
  readonly code: string;
  readonly status: number;
  readonly plan?: McpBillingPlan;

  constructor(message: string, options: { code: string; status: number; plan?: McpBillingPlan }) {
    super(message);
    this.name = "McpCustomerAccessError";
    this.code = options.code;
    this.status = options.status;
    this.plan = options.plan;
  }
}

const PLAN_RANK: Record<McpBillingPlan, number> = {
  free: 0,
  builder: 1,
  pro: 2,
  team: 3,
};

const PROVISIONED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

function normalizePlan(value: string | null | undefined): McpBillingPlan {
  const plan = (value || "free").trim().toLowerCase();
  if (plan === "starter") return "builder";
  if (plan === "business" || plan === "enterprise") return "team";
  if (plan === "builder" || plan === "pro" || plan === "team") return plan;
  return "free";
}

function cutoffPassed(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime();
}

function stripePaidAccessAllowed(row: McpCustomerAccessRow, now: Date): boolean {
  const status = (row.stripe_status || row.subscription_status || "").trim().toLowerCase();
  const invoiceStatus = (row.last_invoice_status || "").trim().toLowerCase();
  const hasGrace = !!row.past_due_grace_expires_at;
  const paymentPastDue = status === "past_due" || (invoiceStatus === "payment_failed" && hasGrace);

  if (paymentPastDue) {
    return hasGrace && !cutoffPassed(row.past_due_grace_expires_at, now);
  }
  return status === "active" || status === "trialing";
}

function lowerPlan(left: McpBillingPlan, right: McpBillingPlan): McpBillingPlan {
  return PLAN_RANK[left] <= PLAN_RANK[right] ? left : right;
}

function decodeMasterKey(value: string | undefined): Buffer | null {
  if (!value?.trim()) return null;
  const decoded = Buffer.from(value.trim(), "base64");
  return decoded.length === 32 ? decoded : null;
}

/**
 * Read-only counterpart to src/lib/api-key-crypto.ts.
 *
 * The MCP service never mints or exposes a customer's key. It unwraps the
 * existing v1 AES-256-GCM envelope only long enough to attach the credential
 * to that customer's server-side API requests. Plaintext support is retained
 * solely for rows created before the at-rest migration.
 */
export function decryptMcpApiKey(stored: string | null | undefined, encryptionKey: string | undefined): string | null {
  if (!stored) return null;
  let plaintext = stored;

  if (stored.startsWith("v1:")) {
    const parts = stored.split(":");
    const masterKey = decodeMasterKey(encryptionKey);
    if (parts.length !== 4 || !masterKey) return null;

    try {
      const iv = Buffer.from(parts[1], "base64");
      const tag = Buffer.from(parts[2], "base64");
      const ciphertext = Buffer.from(parts[3], "base64");
      if (iv.length !== 12 || tag.length !== 16) return null;
      const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }

  // Refuse to place malformed database content in an HTTP credential header.
  return /^NFLMeta_[A-Za-z0-9_-]{24,}$/.test(plaintext) ? plaintext : null;
}

export function evaluateMcpCustomerAccess(
  row: McpCustomerAccessRow | null | undefined,
  encryptionKey: string | undefined,
  now = new Date(),
): McpCustomerAccess {
  if (!row) {
    throw new McpCustomerAccessError("Your NFLMeta customer account is not ready.", {
      code: "account_not_ready",
      status: 403,
    });
  }

  const userId = Number(row.user_id);
  const apiKeyId = Number(row.api_key_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new McpCustomerAccessError("Your NFLMeta customer account is not ready.", {
      code: "account_not_ready",
      status: 403,
    });
  }

  if (!Number.isSafeInteger(apiKeyId) || apiKeyId <= 0 || !row.key_encrypted) {
    throw new McpCustomerAccessError("Your NFLMeta account does not have an active API key.", {
      code: "api_key_unavailable",
      status: 403,
    });
  }

  const manualAccessExpired = cutoffPassed(row.manual_access_expires_at, now);
  const keyPlan = manualAccessExpired ? "free" : normalizePlan(row.api_key_plan);
  const subscriptionPlan = manualAccessExpired ? "free" : normalizePlan(row.subscription_plan);
  // A disagreement can happen transiently while billing state is being
  // repaired. Taking the lower privilege prevents MCP from opening paid access
  // that either of the two existing gates says should be Free.
  const cancellationGrace = Boolean(
    row.cancel_at_period_end
    && row.manual_access_expires_at
    && !manualAccessExpired
    && keyPlan !== "free"
    && subscriptionPlan === "free",
  );
  const plan = cancellationGrace ? keyPlan : lowerPlan(keyPlan, subscriptionPlan);
  const status = (row.stripe_status || row.subscription_status || "").trim().toLowerCase();

  if (plan === "free" || !PROVISIONED_SUBSCRIPTION_STATUSES.has(status) || !stripePaidAccessAllowed(row, now)) {
    throw new McpCustomerAccessError("NFLMeta MCP is available on Builder, Pro, and Team plans.", {
      code: "upgrade_required",
      status: 403,
      plan,
    });
  }

  const apiKey = decryptMcpApiKey(row.key_encrypted, encryptionKey);
  if (!apiKey) {
    throw new McpCustomerAccessError("NFLMeta MCP could not load your API credential. Please try again later.", {
      code: "credential_unavailable",
      status: 503,
      plan,
    });
  }

  return {
    userId,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    plan,
    apiKeyId,
    apiKey,
  };
}

export type McpCustomerAccessResolver = (clerkUserId: string) => Promise<McpCustomerAccess>;

function databaseSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  let sslMode = "";
  try {
    sslMode = new URL(connectionString).searchParams.get("sslmode")?.toLowerCase() || "";
  } catch {
    // Pool will report the malformed connection string when first used.
  }
  if (sslMode === "disable") return undefined;
  if (sslMode || process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" };
  }
  return undefined;
}

export function createDatabaseMcpCustomerAccessResolver(options: {
  connectionString: string;
  encryptionKey: string;
  pool?: Pool;
  now?: () => Date;
}): McpCustomerAccessResolver {
  const pool = options.pool ?? new Pool({
    connectionString: options.connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
    allowExitOnIdle: true,
    application_name: "nflmeta-mcp",
    // This is a separate service pool, not the Next.js request-serving pool.
    // Keep maintenance/import-style timeouts explicit rather than inheriting a
    // future role default from the managed database.
    options: "-c statement_timeout=0 -c idle_in_transaction_session_timeout=0",
    ssl: databaseSsl(options.connectionString),
  });

  return async (clerkUserId: string) => {
    const result = await pool.query<McpCustomerAccessRow>(
      `SELECT u.id AS user_id,
              u.clerk_user_id,
              u.email,
              ak.id AS api_key_id,
              ak.key_encrypted,
              ak.billing_plan AS api_key_plan,
              cs.billing_plan AS subscription_plan,
              cs.status AS subscription_status,
              cs.stripe_status,
              cs.cancel_at_period_end,
              cs.manual_access_expires_at,
              cs.last_invoice_status,
              cs.past_due_grace_expires_at
         FROM app_users u
         LEFT JOIN LATERAL (
           SELECT id, key_encrypted, billing_plan
             FROM api_keys
            WHERE active = TRUE
              AND (user_id = u.id OR email = u.email)
            ORDER BY created_at ASC
            LIMIT 1
         ) ak ON TRUE
         LEFT JOIN customer_subscriptions cs ON cs.user_id = u.id
        WHERE u.clerk_user_id = $1
          AND u.deleted_at IS NULL
        LIMIT 1`,
      [clerkUserId],
    );
    return evaluateMcpCustomerAccess(result.rows[0], options.encryptionKey, options.now?.() ?? new Date());
  };
}
