import type { QueryValue, NFLMetaApiResult } from "./api-client.mjs";

export const CACHE_TTLS_MS = {
  health: 5_000,
  current: 2 * 60_000,
  player: 6 * 60 * 60_000,
  reference: 12 * 60 * 60_000,
  historical: 24 * 60 * 60_000,
} as const;

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
  ttlMs: number;
}

export interface CacheHit<T> {
  value: T;
  ageMs: number;
  ttlMs: number;
}

export class LruTtlCache<T> {
  readonly maxEntries: number;
  readonly entries = new Map<string, CacheEntry<T>>();

  constructor(maxEntries: number) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  get(key: string, now = Date.now()): CacheHit<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { value: entry.value, ageMs: Math.max(0, now - entry.storedAt), ttlMs: entry.ttlMs };
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: now, expiresAt: now + ttlMs, ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

function numericYear(value: QueryValue): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(first ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= 1920 && parsed <= 2200 ? parsed : undefined;
}

function seasonFromData(data: unknown): number | undefined {
  if (Array.isArray(data)) {
    for (const row of data.slice(0, 5)) {
      const season = seasonFromData(row);
      if (season !== undefined) return season;
    }
    return undefined;
  }
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  for (const key of ["season", "season_year", "seasonYear", "year"]) {
    const parsed = numericYear(record[key] as QueryValue);
    if (parsed !== undefined) return parsed;
  }
  for (const key of ["game", "player", "team", "season"]) {
    const parsed = seasonFromData(record[key]);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export function currentNflSeason(now = new Date()): number {
  return now.getUTCMonth() <= 1 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

export function cacheTtlMsForRequest(
  path: string,
  query: Record<string, QueryValue> | undefined,
  data: unknown,
  now = new Date(),
): number {
  if (path === "/api/v1/usage") return 0;
  if (/\/inactives$/.test(path)) return 0;
  if (path === "/api/v1/health") return CACHE_TTLS_MS.health;

  const queryYears = ["season", "season_year", "year", "year_from", "year_to", "election_year"]
    .map((key) => numericYear(query?.[key]))
    .filter((year): year is number => year !== undefined);
  const queryYear = queryYears.length ? Math.max(...queryYears) : undefined;
  const pathYear = [...path.matchAll(/(?:^|\/)((?:19|20)\d{2})(?:\/|$)/g)]
    .map((match) => Number.parseInt(match[1], 10))[0];
  const season = queryYear ?? pathYear ?? seasonFromData(data);
  if (season !== undefined && season < currentNflSeason(now)) return CACHE_TTLS_MS.historical;

  if (/^\/api\/v1\/(?:reference|hall-of-fame|super-bowls|all-star-games|seasons)(?:\/|$)/.test(path)
    || path === "/api/v1/stats/players/catalog") {
    return CACHE_TTLS_MS.reference;
  }
  if (/^\/api\/v1\/players(?:\/|$)/.test(path) && !path.includes("/games")) return CACHE_TTLS_MS.player;
  return CACHE_TTLS_MS.current;
}

export function cacheKey(path: string, query: Record<string, QueryValue> | undefined): string {
  const pairs = Object.entries(query ?? {}).flatMap(([key, rawValue]) => {
    if (rawValue == null) return [];
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    return values.map((value) => [key, String(value)]);
  });
  pairs.sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  const search = new URLSearchParams(pairs).toString();
  return search ? `${path}?${search}` : path;
}

export function resultWithCacheHit(hit: CacheHit<NFLMetaApiResult>): NFLMetaApiResult {
  const result = structuredClone(hit.value);
  const existingMeta = result.meta;
  const meta = existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
    ? { ...(existingMeta as Record<string, unknown>) }
    : existingMeta == null ? {} : { downstream: existingMeta };
  return {
    ...result,
    meta: {
      ...meta,
      mcp_cache: {
        status: "hit",
        age_seconds: Number((hit.ageMs / 1_000).toFixed(3)),
        ttl_seconds: hit.ttlMs / 1_000,
      },
    },
  };
}
