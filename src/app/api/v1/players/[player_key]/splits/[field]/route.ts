import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getPlayerSplitsByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, field } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  if (seasonRaw && !Number.isFinite(season as number)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  // Same as the parent splits route: without a season this returned zeros
  // rather than an answer. See that route for why there is no career variant.
  if (!seasonRaw) {
    return jsonApiError(auth, 400, "invalid_request", "season is required");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "ALL").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const data = await getPlayerSplitsByKey(decodeURIComponent(player_key), { season, seasonType });
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player splits field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
