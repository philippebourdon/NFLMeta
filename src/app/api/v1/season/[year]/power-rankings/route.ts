import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isPublicSeasonYear } from "@/lib/public-data";
import { getSeasonPowerRankings } from "@/lib/raw-api-data";
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
    return jsonApiError(auth, 404, "not_found", "season power rankings not found");
  }

  const data = await getSeasonPowerRankings(seasonYear);
  return jsonWithRateLimit(auth, { data, meta: { season_year: seasonYear, returned: data.length } });
}

export const GET = withApiErrorHandling(handleGET);
