import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { quotaUsagePercent, quotaWarningLevel } from "@/lib/quota-messaging";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const requestUsagePercent = quotaUsagePercent(auth.requestCount, auth.quotaLimit);
  const rowUsagePercent = auth.rowQuotaLimit === null
    ? null
    : quotaUsagePercent(auth.rowCount, auth.rowQuotaLimit);

  return jsonWithRateLimit(auth, {
    data: {
      api_key_id: auth.keyId,
      billing_plan: auth.billingPlan,
      minute_request_count: auth.minuteRequestCount,
      minute_limit: auth.minuteLimit,
      minute_remaining: auth.minuteRemaining,
      minute_reset_at: auth.minuteResetAt,
      minute_policy: auth.minutePolicy,
      quota_source: auth.quotaSource,
      request_count: auth.requestCount,
      lifetime_request_count: auth.lifetimeRequestCount,
      quota_limit: auth.quotaLimit,
      quota_remaining: auth.quotaRemaining,
      quota_reset_at: auth.quotaResetAt,
      policy: auth.quotaPolicy,
      // Rows, not just requests. Rows are usually the binding constraint -- a
      // caller averaging six rows a request exhausts the free row budget with a
      // fifth of its requests unused -- and until now they appeared only in
      // response headers, so a client could not poll its own budget. Null on
      // Team, which has no row ceiling.
      row_count: auth.rowCount,
      row_quota_limit: auth.rowQuotaLimit,
      row_quota_remaining: auth.rowQuotaRemaining,
      request_usage_percent: requestUsagePercent,
      request_warning_level: quotaWarningLevel(requestUsagePercent),
      row_usage_percent: rowUsagePercent,
      row_warning_level: rowUsagePercent === null ? "uncapped" : quotaWarningLevel(rowUsagePercent),
      usage_guidance_url: "https://nflmeta.org/api-docs/authentication#handling-429-responses",
      upgrade_url: "https://nflmeta.org/pricing",
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
