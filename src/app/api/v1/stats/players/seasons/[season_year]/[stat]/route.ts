import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isAllowedPlayerCareerSeasonStat, listPlayerCareerSeasonLeaders } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handleGET(req: NextRequest, ctx: { params: Promise<{ season_year: string; stat: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { season_year, stat: statParam } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear) || seasonYear < 1900 || seasonYear > 2100) {
    return jsonApiError(auth, 400, "invalid_request", "season_year is required");
  }

  const stat = decodeURIComponent(statParam).trim().toLowerCase();
  if (!stat || !isAllowedPlayerCareerSeasonStat(stat)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid stat");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "").trim().toUpperCase();
  const seasonType = seasonTypeRaw ? seasonTypeRaw : undefined;
  if (seasonType && seasonType !== "REG" && seasonType !== "POST") {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG or POST");
  }

  const orderRaw = (req.nextUrl.searchParams.get("order") || "desc").trim().toLowerCase();
  const order = orderRaw === "asc" ? "asc" : orderRaw === "desc" ? "desc" : null;
  if (!order) {
    return jsonApiError(auth, 400, "invalid_request", "order must be asc or desc");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 50, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100_000);
  const minValue = parseOptionalNumber(req.nextUrl.searchParams.get("min_value"));
  const maxValue = parseOptionalNumber(req.nextUrl.searchParams.get("max_value"));

  const result = await listPlayerCareerSeasonLeaders({
    seasonYear,
    seasonType,
    stat,
    team: req.nextUrl.searchParams.get("team") || undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    positionGroup: req.nextUrl.searchParams.get("position_group") || undefined,
    seasonPosition: req.nextUrl.searchParams.get("season_position") || undefined,
    seasonPositionGroup: req.nextUrl.searchParams.get("season_position_group") || undefined,
    depthChartPosition: req.nextUrl.searchParams.get("depth_chart_position") || undefined,
    minGames: parseOptionalInt(req.nextUrl.searchParams.get("min_games")),
    minStarts: parseOptionalInt(req.nextUrl.searchParams.get("min_starts")),
    minPassAtt: parseOptionalInt(req.nextUrl.searchParams.get("min_pass_att")),
    minRushAtt: parseOptionalInt(req.nextUrl.searchParams.get("min_rush_att")),
    minTargets: parseOptionalInt(req.nextUrl.searchParams.get("min_targets")),
    minRec: parseOptionalInt(req.nextUrl.searchParams.get("min_rec")),
    minFga: parseOptionalInt(req.nextUrl.searchParams.get("min_fga")),
    minPunts: parseOptionalInt(req.nextUrl.searchParams.get("min_punts")),
    search: req.nextUrl.searchParams.get("search") || undefined,
    minValue,
    maxValue,
    order,
    limit,
    offset,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
      season_year: seasonYear,
      season_type: seasonType || null,
      stat,
      order,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
