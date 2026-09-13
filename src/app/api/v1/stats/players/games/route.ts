import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isAllowedPlayerGameStat, listPlayerGameStatLeaders } from "@/lib/raw-api-data";
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

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const seasonYear = parseOptionalInt(req.nextUrl.searchParams.get("season_year"));
  if (!seasonYear || seasonYear < 1900 || seasonYear > 2100) {
    return jsonApiError(auth, 400, "invalid_request", "season_year is required");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "REG").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const stat = (req.nextUrl.searchParams.get("stat") || "").trim().toLowerCase();
  if (!stat || !isAllowedPlayerGameStat(stat)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid stat");
  }

  const orderRaw = (req.nextUrl.searchParams.get("order") || "desc").trim().toLowerCase();
  const order = orderRaw === "asc" ? "asc" : orderRaw === "desc" ? "desc" : null;
  if (!order) {
    return jsonApiError(auth, 400, "invalid_request", "order must be asc or desc");
  }

  const homeAwayRaw = (req.nextUrl.searchParams.get("home_away") || "").trim().toLowerCase();
  const homeAway =
    homeAwayRaw === ""
      ? undefined
      : homeAwayRaw === "home" || homeAwayRaw === "away"
        ? homeAwayRaw
        : undefined;
  if (homeAwayRaw && homeAway === undefined) {
    return jsonApiError(auth, 400, "invalid_request", "home_away must be home or away");
  }

  const resultRaw = (req.nextUrl.searchParams.get("result") || "").trim().toUpperCase();
  const result =
    resultRaw === ""
      ? undefined
      : resultRaw === "W" || resultRaw === "L" || resultRaw === "T"
        ? resultRaw
        : undefined;
  if (resultRaw && result === undefined) {
    return jsonApiError(auth, 400, "invalid_request", "result must be W, L, or T");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 50, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100_000);
  const minValue = parseOptionalNumber(req.nextUrl.searchParams.get("min_value"));
  const maxValue = parseOptionalNumber(req.nextUrl.searchParams.get("max_value"));

  const query = {
    seasonYear,
    seasonType,
    stat,
    week: parseOptionalInt(req.nextUrl.searchParams.get("week")),
    weekFrom: parseOptionalInt(req.nextUrl.searchParams.get("week_from")),
    weekTo: parseOptionalInt(req.nextUrl.searchParams.get("week_to")),
    team: req.nextUrl.searchParams.get("team") || undefined,
    opponent: req.nextUrl.searchParams.get("opponent") || undefined,
    homeAway,
    result,
    position: req.nextUrl.searchParams.get("position") || undefined,
    search: req.nextUrl.searchParams.get("search") || undefined,
    minPassAtt: parseOptionalInt(req.nextUrl.searchParams.get("min_pass_att")),
    minRushAtt: parseOptionalInt(req.nextUrl.searchParams.get("min_rush_att")),
    minTargets: parseOptionalInt(req.nextUrl.searchParams.get("min_targets")),
    minRec: parseOptionalInt(req.nextUrl.searchParams.get("min_rec")),
    minFga: parseOptionalInt(req.nextUrl.searchParams.get("min_fga")),
    minPunts: parseOptionalInt(req.nextUrl.searchParams.get("min_punts")),
    minValue,
    maxValue,
    order,
    limit,
    offset,
  } as const;

  const resultRows = await listPlayerGameStatLeaders(query);

  return jsonWithRateLimit(auth, {
    data: resultRows.rows,
    meta: {
      total: resultRows.total,
      limit,
      offset,
      returned: resultRows.rows.length,
      has_more: offset + resultRows.rows.length < resultRows.total,
      season_year: seasonYear,
      season_type: seasonType,
      stat,
      order,
      filters: {
        week: query.week ?? null,
        week_from: query.weekFrom ?? null,
        week_to: query.weekTo ?? null,
        team: query.team ?? null,
        opponent: query.opponent ?? null,
        home_away: query.homeAway ?? null,
        result: query.result ?? null,
        position: query.position ?? null,
        search: query.search ?? null,
        min_pass_att: query.minPassAtt ?? null,
        min_rush_att: query.minRushAtt ?? null,
        min_targets: query.minTargets ?? null,
        min_rec: query.minRec ?? null,
        min_fga: query.minFga ?? null,
        min_punts: query.minPunts ?? null,
        min_value: minValue ?? null,
        max_value: maxValue ?? null,
      },
      coverage_note:
        seasonType === "REG"
          ? "Cross-player game stat queries currently use regular-season boxscore data."
          : seasonType === "POST"
            ? "Cross-player game stat queries currently use structured postseason player stat tables."
            : "Cross-player game stat queries combine regular-season boxscore data with structured postseason player stat tables.",
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
