import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerKickerSeasonStatsByKey, getPlayerKickerSeasonStatsByKeyAndYear } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { seasonDataUnavailableMessage } from "@/lib/data-availability-message";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; season_year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, season_year } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "season_year must be a number");
  }

  const decodedPlayerKey = decodeURIComponent(player_key);
  const data = await getPlayerKickerSeasonStatsByKeyAndYear(decodedPlayerKey, seasonYear);
  if (!data) {
    const available = await getPlayerKickerSeasonStatsByKey(decodedPlayerKey);
    const latestAvailableSeason = Number(available[0]?.season_year);
    if (Number.isFinite(latestAvailableSeason)) {
      return jsonApiError(auth, 404, "not_found", seasonDataUnavailableMessage({
        requestedSeason: seasonYear,
        latestAvailableSeason,
        resource: "kicking statistics",
      }));
    }
    return jsonApiError(auth, 404, "not_found", "player kicking season stats not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
