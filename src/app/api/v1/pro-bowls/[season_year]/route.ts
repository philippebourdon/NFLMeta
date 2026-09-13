import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getProBowlSeason } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ season_year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { season_year } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season_year");
  }

  const data = await getProBowlSeason(seasonYear);
  if (!data.game && !data.selections.length && !data.bios.length && !data.stats.length) {
    return jsonApiError(auth, 404, "not_found", "pro bowl season not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
