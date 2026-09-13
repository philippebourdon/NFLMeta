import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getPlayerPunterSeasonStatsByKeyAndYear } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; season_year: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, season_year, field } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "season_year must be a number");
  }

  const data = await getPlayerPunterSeasonStatsByKeyAndYear(decodeURIComponent(player_key), seasonYear);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player punting season stats not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player punting season field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
