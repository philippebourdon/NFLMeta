import { createHash } from "node:crypto";

import { LruTtlCache, cacheKey, cacheTtlMsForRequest, resultWithCacheHit } from "./cache.mjs";

export type QueryValue = string | number | boolean | readonly (string | number | boolean)[] | null | undefined;

export interface NFLMetaApiResult {
  data: unknown;
  meta?: unknown;
  rateLimit: {
    limit?: number;
    remaining?: number;
    reset?: string;
    policy?: string;
  };
}

export class NFLMetaApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "NFLMetaApiError";
    this.status = options.status;
    this.code = options.code || "nflmeta_api_error";
    this.details = options.details;
  }
}

export interface NFLMetaApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  fetch?: typeof fetch;
  cacheEnabled?: boolean;
  cacheMaxEntries?: number;
  cache?: LruTtlCache<NFLMetaApiResult>;
  now?: () => number;
}

const sharedCaches = new WeakMap<typeof fetch, Map<string, LruTtlCache<NFLMetaApiResult>>>();

function sharedCache(fetchImpl: typeof fetch, baseUrl: string, apiKey: string | undefined, maxEntries: number) {
  let caches = sharedCaches.get(fetchImpl);
  if (!caches) {
    caches = new Map();
    sharedCaches.set(fetchImpl, caches);
  }
  const credentialScope = createHash("sha256").update(apiKey ?? "anonymous").digest("hex").slice(0, 16);
  const namespace = `${baseUrl}|${credentialScope}|${maxEntries}`;
  let cache = caches.get(namespace);
  if (!cache) {
    cache = new LruTtlCache<NFLMetaApiResult>(maxEntries);
    caches.set(namespace, cache);
  }
  return cache;
}

function parseIntegerHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function appendQuery(url: URL, query: Record<string, QueryValue> | undefined): void {
  if (!query) return;
  for (const [name, rawValue] of Object.entries(query)) {
    if (rawValue == null) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) url.searchParams.append(name, String(value));
  }
}

function messageFromPayload(payload: unknown, fallback: string): { message: string; code?: string } {
  if (payload && typeof payload === "object") {
    const body = payload as { error?: { message?: unknown; code?: unknown }; message?: unknown };
    if (typeof body.error?.message === "string") {
      return {
        message: body.error.message,
        code: typeof body.error.code === "string" ? body.error.code : undefined,
      };
    }
    if (typeof body.message === "string") return { message: body.message };
  }
  return { message: fallback };
}

function createRequestSignal(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("NFLMeta API request timed out")), timeoutMs);
  const abort = () => controller.abort(external?.reason);
  if (external?.aborted) abort();
  else external?.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      external?.removeEventListener("abort", abort);
    },
  };
}

export class NFLMetaApiClient {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly fetchImpl: typeof fetch;
  readonly cacheEnabled: boolean;
  readonly cache: LruTtlCache<NFLMetaApiResult>;
  readonly now: () => number;

  constructor(options: NFLMetaApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey?.trim() || undefined;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetch || fetch;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.now = options.now ?? Date.now;
    const cacheMaxEntries = Math.max(1, Math.floor(options.cacheMaxEntries ?? 500));
    this.cache = options.cache ?? sharedCache(this.fetchImpl, this.baseUrl, this.apiKey, cacheMaxEntries);
  }

  async get(
    path: string,
    query?: Record<string, QueryValue>,
    signal?: AbortSignal,
  ): Promise<NFLMetaApiResult> {
    if (!path.startsWith("/api/v1/") || path.includes("?") || path.includes("#")) {
      throw new NFLMetaApiError("Only clean /api/v1/* paths are allowed", { code: "invalid_path" });
    }

    const base = new URL(`${this.baseUrl}/`);
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith("/api/v1/")) {
      throw new NFLMetaApiError("The API path resolved outside /api/v1", { code: "invalid_path" });
    }
    appendQuery(url, query);

    const key = cacheKey(path, query);
    if (this.cacheEnabled) {
      const hit = this.cache.get(key, this.now());
      if (hit) return resultWithCacheHit(hit);
    }

    const headers = new Headers({
      Accept: "application/json",
      "User-Agent": "nflmeta-mcp/0.1.0",
    });
    if (this.apiKey) headers.set("X-NFLMeta-Key", this.apiKey);

    const requestSignal = createRequestSignal(signal, this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers,
        signal: requestSignal.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const parsed = messageFromPayload(payload, `NFLMeta API returned HTTP ${response.status}`);
        throw new NFLMetaApiError(parsed.message, {
          status: response.status,
          code: parsed.code,
          details: payload,
        });
      }
      if (!payload || typeof payload !== "object" || !("data" in payload)) {
        throw new NFLMetaApiError("NFLMeta API returned an invalid response envelope", {
          status: response.status,
          code: "invalid_response",
        });
      }

      const envelope = payload as { data: unknown; meta?: unknown };
      const result = {
        data: envelope.data,
        meta: envelope.meta,
        rateLimit: {
          limit: parseIntegerHeader(response.headers, "X-RateLimit-Limit"),
          remaining: parseIntegerHeader(response.headers, "X-RateLimit-Remaining"),
          reset: response.headers.get("X-RateLimit-Reset") || undefined,
          policy: response.headers.get("X-RateLimit-Policy") || undefined,
        },
      };
      if (this.cacheEnabled) {
        const now = this.now();
        const ttlMs = cacheTtlMsForRequest(path, query, result.data, new Date(now));
        this.cache.set(key, structuredClone(result), ttlMs, now);
      }
      return result;
    } catch (error) {
      if (error instanceof NFLMetaApiError) throw error;
      if (requestSignal.signal.aborted) {
        throw new NFLMetaApiError("NFLMeta API request was cancelled or timed out", {
          code: "request_aborted",
        });
      }
      throw new NFLMetaApiError(error instanceof Error ? error.message : "NFLMeta API request failed", {
        code: "network_error",
      });
    } finally {
      requestSignal.cleanup();
    }
  }
}
