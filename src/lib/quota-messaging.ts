export type QuotaKind = "requests" | "rows";
export type QuotaThreshold = 80 | 90 | 100;

const THRESHOLDS: readonly QuotaThreshold[] = [80, 90, 100];

export function quotaUsagePercent(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((used / limit) * 100)));
}

export function quotaWarningLevel(percent: number): "none" | "approaching" | "critical" | "exhausted" {
  if (percent >= 100) return "exhausted";
  if (percent >= 90) return "critical";
  if (percent >= 80) return "approaching";
  return "none";
}

/**
 * Returns the highest threshold crossed by one accepted usage increment.
 *
 * Row responses can add hundreds of records at once and cross more than one
 * threshold. Sending only the highest crossed notice avoids delivering an 80%
 * and 90% email together while still making the customer's current position
 * clear. Notification keys make each returned threshold idempotent per month.
 */
export function highestCrossedQuotaThreshold(
  previousUsed: number,
  currentUsed: number,
  limit: number,
): QuotaThreshold | null {
  if (!Number.isFinite(limit) || limit <= 0 || currentUsed <= previousUsed) return null;

  let crossed: QuotaThreshold | null = null;
  for (const threshold of THRESHOLDS) {
    const boundary = Math.ceil((limit * threshold) / 100);
    if (previousUsed < boundary && currentUsed >= boundary) crossed = threshold;
  }
  return crossed;
}

export function quotaKindLabel(kind: QuotaKind): string {
  return kind === "requests" ? "request quota" : "row allowance";
}

export function billingPlanLabel(plan: string): string {
  const normalized = plan.trim().toLowerCase();
  if (!normalized) return "Free";
  return normalized[0].toUpperCase() + normalized.slice(1);
}

export function quotaLimitMessage(input: {
  kind: QuotaKind | "per_minute";
  plan: string;
  limit: number;
  remaining?: number;
  resetAt: string;
  responseRows?: number;
}): string {
  const plan = billingPlanLabel(input.plan);
  const upgrade = "See https://nflmeta.org/pricing for larger limits.";

  if (input.kind === "per_minute") {
    return `per-minute rate limit exceeded for the ${plan} plan (${input.limit} requests per minute). `
      + `Retry after the ${input.resetAt} reset. ${upgrade}`;
  }

  if (input.kind === "rows" && input.remaining !== undefined && input.remaining > 0) {
    return `monthly row allowance would be exceeded for the ${plan} plan: this response contains `
      + `${input.responseRows ?? 0} rows and ${input.remaining} remain of ${input.limit} until ${input.resetAt}. `
      + `Request a smaller page or narrower fields. ${upgrade}`;
  }

  const label = input.kind === "requests" ? "request quota" : "row allowance";
  return `monthly ${label} exhausted for the ${plan} plan (${input.limit} per UTC month). `
    + `Access resets at ${input.resetAt}. ${upgrade}`;
}
