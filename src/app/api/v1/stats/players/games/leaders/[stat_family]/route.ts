import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isAllowedPlayerGameStat, listPlayerGameStatLeaders } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

const DEFAULT_STATS: Record<string, string> = {
  passing: "pass_yds",
  rushing: "rush_yds",
  receiving: "rec_yds",
  defense: "def_sacks",
  returns: "kick_return_yds",
  kicking: "fgm",
  punting: "punt_yds",
  fumbles: "fumbles",
  misc: "pass_td",
};

async function handleGET(req: NextRequest, ctx: { params: Promise<{ stat_family: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { stat_family } = await ctx.params;
  const family = String(stat_family || "").trim().toLowerCase();
  const defaultStat = DEFAULT_STATS[family];
  if (!defaultStat) {
    return jsonApiError(auth, 400, "invalid_request", "invalid stat_family");
  }

  const seasonYear = Number.parseInt(req.nextUrl.searchParams.get("season_year") || "", 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "season_year is required");
  }

  const stat = (req.nextUrl.searchParams.get("stat") || defaultStat).trim().toLowerCase();
  if (!isAllowedPlayerGameStat(stat)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid stat");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "ALL").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const data = await listPlayerGameStatLeaders({
    seasonYear,
    seasonType,
    stat,
    week: undefined,
    weekFrom: undefined,
    weekTo: undefined,
    team: req.nextUrl.searchParams.get("team") || undefined,
    opponent: req.nextUrl.searchParams.get("opponent") || undefined,
    homeAway: undefined,
    result: undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    search: req.nextUrl.searchParams.get("search") || undefined,
    minPassAtt: undefined,
    minRushAtt: undefined,
    minTargets: undefined,
    minRec: undefined,
    minFga: undefined,
    minPunts: undefined,
    minValue: undefined,
    maxValue: undefined,
    order: "desc",
    limit: Number.parseInt(req.nextUrl.searchParams.get("limit") || "50", 10),
    offset: Number.parseInt(req.nextUrl.searchParams.get("offset") || "0", 10),
  });

  return jsonWithRateLimit(auth, {
    data: data.rows,
    meta: {
      total: data.total,
      stat_family: family,
      stat,
      season_year: seasonYear,
      season_type: seasonType,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
