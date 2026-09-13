import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerSplitsByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  if (seasonRaw && !Number.isFinite(season as number)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  // Splits are built from whole-game boxscores and filtered down to this
  // player afterwards, so there is no query that answers "every season" at a
  // sensible cost. Without a season the collector skipped the game query
  // entirely and this returned a 200 full of zeros, which reads as "he never
  // played" rather than "ask me a narrower question".
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

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
