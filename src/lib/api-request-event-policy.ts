import { FixedWindowRateLimiter } from "@/lib/fixed-window-rate-limit";

/**
 * Failed authentication is useful operational evidence, but it is not usage
 * metering. Recording every rejected request lets an unauthenticated caller
 * turn a cheap 401 into an unlimited write stream in the customer database.
 *
 * Keep a small sample instead: two events per source and ten events globally
 * per minute. The API response is unchanged; only the diagnostic row is
 * sampled. Successful/key-owned events still record in full.
 */
export const REJECTED_API_EVENT_WINDOW_MS = 60_000;
export const REJECTED_API_EVENT_PER_CLIENT = 2;
export const REJECTED_API_EVENT_GLOBAL = 10;

const REJECTED_AUTH_RESULTS = new Set([
  "missing_api_key",
  "invalid_api_key",
  "invalid_enforced_key",
]);

export function rejectedApiEventClientKey(headers: Pick<Headers, "get">): string {
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const forwardedFor = headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  if (firstForwardedIp) return firstForwardedIp;

  return headers.get("x-real-ip")?.trim() || "unattributed";
}

export class ApiRequestEventAdmission {
  private readonly rejectedLimiter: FixedWindowRateLimiter;

  constructor(options: {
    windowMs?: number;
    perClient?: number;
    global?: number;
    maxClients?: number;
    now?: () => number;
  } = {}) {
    this.rejectedLimiter = new FixedWindowRateLimiter({
      windowMs: options.windowMs ?? REJECTED_API_EVENT_WINDOW_MS,
      perClient: options.perClient ?? REJECTED_API_EVENT_PER_CLIENT,
      global: options.global ?? REJECTED_API_EVENT_GLOBAL,
      maxClients: options.maxClients,
      now: options.now,
    });
  }

  shouldRecord(authResult: string, headers: Pick<Headers, "get">): boolean {
    if (!REJECTED_AUTH_RESULTS.has(authResult)) return true;
    return this.rejectedLimiter.allow(rejectedApiEventClientKey(headers));
  }
}
