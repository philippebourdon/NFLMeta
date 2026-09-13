import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isPublicSeasonYear } from "@/lib/public-data";
import { getSeasonSummary } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { year } = await ctx.params;
  const seasonYear = Number.parseInt(year, 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid year");
  }
  if (!(await isPublicSeasonYear(seasonYear))) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  const data = await getSeasonSummary(seasonYear);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "season summary not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
