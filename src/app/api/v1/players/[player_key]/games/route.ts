import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerGameLogsByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const weekRaw = req.nextUrl.searchParams.get("week");
  const seasonType = (req.nextUrl.searchParams.get("season_type") || "REG").trim().toUpperCase();
  if (seasonType !== "REG" && seasonType !== "POST" && seasonType !== "ALL") {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const week = weekRaw ? Number.parseInt(weekRaw, 10) : undefined;

  if (seasonRaw && !Number.isFinite(season as number)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  if (weekRaw && !Number.isFinite(week as number)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid week");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 20, 1, 100);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 10000);

  const result = await getPlayerGameLogsByKey(decodeURIComponent(player_key), {
    season,
    seasonType,
    week,
    limit,
    offset,
  });

  if (!result) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  return jsonWithRateLimit(auth, {
    data: result.logs,
    meta: {
      player: result.player,
      season: season ?? null,
      season_type: seasonType,
      week: week ?? null,
      limit,
      offset,
      returned: result.logs.length,
      total: result.total,
      has_more: offset + result.logs.length < result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
