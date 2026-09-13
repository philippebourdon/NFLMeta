import { NFLMetaInvalidUrlError, NFLMetaTimeoutError, createHttpError } from "./errors.js";
import type {
  NFLMetaClientOptions,
  NFLMetaEnvelope,
  QueryParams,
  RateLimitInfo,
  RequestOptions,
  UnknownRecord,
} from "./types.js";

/** How many same-origin redirects to follow before giving up. */
const MAX_REDIRECTS = 5;

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Resolve a caller-supplied path against the configured base, and refuse
 * anything that leaves it.
 *
 * This used to accept any absolute http(s) URL and then attach X-NFLMeta-Key to
 * it unconditionally, so an application that passed a user-controlled or
 * mistakenly absolute URL handed its API key to whatever host was named. It is
 * an easy mistake to make and the client did not warn or fail.
 *
 * The boundary is the same one mcp-server/src/api-client.mts already enforces:
 * resolve against the base, require the result to stay on that origin, and keep
 * the path inside /api/v1. Every endpoint this client can reach lives there, so
 * the path rule costs nothing and catches a whole class of typo.
 *
 * Same-origin absolute URLs are still accepted -- they are not a leak, and
 * rejecting them would break callers who build URLs themselves.
 */
function resolveRequestUrl(baseUrl: string, path: string): URL {
  const base = new URL(`${baseUrl}/`);
  let url: URL;
  try {
    url = new URL(path, base);
  } catch {
    throw new NFLMetaInvalidUrlError(`Not a usable request path: ${path}`);
  }
  if (url.origin !== base.origin) {
    throw new NFLMetaInvalidUrlError(
      `Refusing to send the API key to ${url.origin}. Requests must stay on ${base.origin}.`,
    );
  }
  if (!url.pathname.startsWith("/api/v1/")) {
    throw new NFLMetaInvalidUrlError(`The request path resolved outside /api/v1: ${url.pathname}`);
  }
  return url;
}

/**
 * Resolve a Location header against the URL that produced it, and refuse to
 * follow it off-origin.
 *
 * Redirects are a second way the key escapes, and one the request-URL check
 * does not cover. Measured on 2026-08-27 against a local server: Node's fetch
 * strips Authorization on a cross-origin redirect but forwards X-NFLMeta-Key
 * intact, so following one blindly hands the key to the redirect target.
 *
 * Same-origin redirects are followed normally -- the API normalises trailing
 * slashes with a 308 and that has to keep working.
 */
function resolveRedirect(from: URL, location: string): URL {
  let next: URL;
  try {
    next = new URL(location, from);
  } catch {
    throw new NFLMetaInvalidUrlError(`The API returned a redirect that is not a usable URL: ${location}`);
  }
  if (next.origin !== from.origin) {
    throw new NFLMetaInvalidUrlError(
      `Refusing to follow a redirect to ${next.origin}, which would send the API key off ${from.origin}.`,
    );
  }
  return next;
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  const base = (baseUrl || "https://nflmeta.org").trim();
  return base.replace(/\/+$/, "");
}

function encodeQueryValue(value: string | number | boolean | Date): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function appendQuery(url: URL, query: QueryParams | undefined): void {
    if (!query) return;
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue == null) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value == null) continue;
      if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        url.searchParams.append(key, encodeQueryValue(value));
      }
    }
  }
}

function parseNumberHeader(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseNumberHeader(headers, "X-RateLimit-Limit"),
    remaining: parseNumberHeader(headers, "X-RateLimit-Remaining"),
    reset: headers.get("X-RateLimit-Reset") || undefined,
    policy: headers.get("X-RateLimit-Policy") || undefined,
  };
}

function mergeHeaders(base: HeadersInit | undefined, extra: HeadersInit | undefined): Headers {
  const headers = new Headers(base);
  if (extra) {
    const additions = new Headers(extra);
    additions.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : undefined;
}

function createAbortContext(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  if (!signal && (!timeoutMs || timeoutMs <= 0)) {
    return {
      signal: undefined as AbortSignal | undefined,
      cleanup: () => undefined,
      didTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      onAbort = () => controller.abort(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    },
    didTimeout: () => timedOut,
  };
}

export class NFLMetaClientCore {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchImpl: typeof fetch;
  readonly defaultHeaders?: HeadersInit;

  constructor(options: NFLMetaClientOptions = {}) {
    this.apiKey = options.apiKey?.trim() || undefined;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch || fetch;
    this.defaultHeaders = options.headers;
  }

  async get<TData = UnknownRecord, TMeta = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<NFLMetaEnvelope<TData, TMeta>> {
    // Before any header is built: a URL that leaves the configured origin must
    // never reach the point where the key is attached.
    const url = resolveRequestUrl(this.baseUrl, path);
    appendQuery(url, options.query);

    const headers = mergeHeaders(this.defaultHeaders, options.headers);
    headers.set("Accept", "application/json");
    if (this.apiKey && !headers.has("X-NFLMeta-Key")) {
      headers.set("X-NFLMeta-Key", this.apiKey);
    }

    const abort = createAbortContext(options.signal, this.timeoutMs);

    try {
      // redirect: "manual" so each hop can be checked before the key is sent
      // again. Left to itself, fetch forwards X-NFLMeta-Key across origins.
      let target = url;
      let response = await this.fetchImpl(target, {
        method: "GET",
        headers,
        signal: abort.signal,
        redirect: "manual",
      });

      for (let hop = 0; isRedirectStatus(response.status); hop += 1) {
        if (hop >= MAX_REDIRECTS) {
          throw new NFLMetaInvalidUrlError(`The API redirected more than ${MAX_REDIRECTS} times.`);
        }
        const location = response.headers.get("location");
        if (!location) break;
        target = resolveRedirect(target, location);
        response = await this.fetchImpl(target, {
          method: "GET",
          headers,
          signal: abort.signal,
          redirect: "manual",
        });
      }

      // A browser cannot show us a redirect under redirect: "manual" -- it hands
      // back an opaque response with status 0 and no Location, so there is
      // nothing to check. This client is documented as server-side only (the API
      // sends no CORS headers), but say so plainly rather than failing oddly.
      if (response.type === "opaqueredirect") {
        throw new NFLMetaInvalidUrlError(
          "The API redirected, and this environment hides the target so it cannot be checked. Use this client server-side.",
        );
      }

      const rateLimit = parseRateLimit(response.headers);
      const payload = await parsePayload(response);

      if (!response.ok) {
        throw createHttpError(response.status, payload, rateLimit);
      }

      if (typeof payload !== "object" || payload === null || !("data" in payload)) {
        throw createHttpError(response.status, payload, rateLimit);
      }

      const body = payload as { data: TData; meta?: TMeta };
      return {
        data: body.data,
        meta: body.meta,
        status: response.status,
        rateLimit,
        headers: response.headers,
      };
    } catch (error) {
      if (abort.didTimeout()) {
        throw new NFLMetaTimeoutError(this.timeoutMs || 0);
      }
      throw error;
    } finally {
      abort.cleanup();
    }
  }
}
