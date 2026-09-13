import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getSeasonSummary } from "@/lib/metadata-api";
import { isPublicSeasonYear } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { year } = await ctx.params;
  const seasonYear = Number.parseInt(year, 10);
  if (!Number.isFinite(seasonYear) || seasonYear <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  if (!(await isPublicSeasonYear(seasonYear))) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  const record = await getSeasonSummary(seasonYear);
  if (!record) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  return jsonWithRateLimit(auth, { data: record });
}

export const GET = withApiErrorHandling(handleGET);
