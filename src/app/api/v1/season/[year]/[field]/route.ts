import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getSeasonSummary } from "@/lib/metadata-api";
import { isPublicSeasonYear } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ year: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { year, field } = await ctx.params;
  const seasonYear = Number.parseInt(year, 10);
  if (!Number.isFinite(seasonYear) || seasonYear <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  if (!(await isPublicSeasonYear(seasonYear))) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  const data = await getSeasonSummary(seasonYear);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported season summary field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
