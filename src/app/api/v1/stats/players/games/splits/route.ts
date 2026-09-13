import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isAllowedPlayerGameStat, listPlayerGameStatSplits } from "@/lib/raw-api-data";
import { GAME_STAT_SPLITS, type GameStatSplit } from "@/lib/game-stat-splits";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const seasonYear = Number.parseInt(req.nextUrl.searchParams.get("season_year") || "", 10);
  if (!/^\d{4}$/.test(req.nextUrl.searchParams.get("season_year") || "") || seasonYear < 1900 || seasonYear > 2100) {
    return jsonApiError(auth, 400, "invalid_request", "season_year is required");
  }

  const stat = (req.nextUrl.searchParams.get("stat") || "").trim().toLowerCase();
  if (!stat || !isAllowedPlayerGameStat(stat)) {
    return jsonApiError(auth, 400, "invalid_request", "a supported game stat is required");
  }

  const splitByRaw = (req.nextUrl.searchParams.get("split_by") || "week").trim().toLowerCase();
  const splitBy = (GAME_STAT_SPLITS as readonly string[]).includes(splitByRaw) ? splitByRaw as GameStatSplit : null;
  if (!splitBy) {
    return jsonApiError(auth, 400, "invalid_request", "invalid split_by");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "ALL").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 1000);
  const p = req.nextUrl.searchParams;
  const homeAway = p.get("home_away") || undefined;
  const gameResult = p.get("result")?.toUpperCase() || undefined;
  if (homeAway && homeAway !== "home" && homeAway !== "away") return jsonApiError(auth, 400, "invalid_request", "home_away must be home or away");
  if (gameResult && !["W", "L", "T"].includes(gameResult)) return jsonApiError(auth, 400, "invalid_request", "result must be W, L, or T");
  const weeks: Record<string, number | undefined> = {};
  for (const key of ["week", "week_from", "week_to"]) {
    const raw = p.get(key);
    if (raw && (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 25)) return jsonApiError(auth, 400, "invalid_request", `${key} must be 1-25`);
    weeks[key] = raw ? Number(raw) : undefined;
  }
  if (weeks.week_from && weeks.week_to && weeks.week_from > weeks.week_to) return jsonApiError(auth, 400, "invalid_request", "week_to must not precede week_from");
  const result = await listPlayerGameStatSplits({
    seasonYear,
    seasonType,
    stat,
    team: req.nextUrl.searchParams.get("team") || undefined,
    opponent: req.nextUrl.searchParams.get("opponent") || undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    search: req.nextUrl.searchParams.get("search") || undefined,
    week: weeks.week,
    weekFrom: weeks.week_from,
    weekTo: weeks.week_to,
    homeAway: homeAway as "home" | "away" | undefined,
    result: gameResult as "W" | "L" | "T" | undefined,
    minPassAtt: undefined,
    minRushAtt: undefined,
    minTargets: undefined,
    minRec: undefined,
    minFga: undefined,
    minPunts: undefined,
    minValue: undefined,
    maxValue: undefined,
    order: "desc",
    limit,
    offset: 0,
  }, splitBy);

  return jsonWithRateLimit(auth, result);
}

export const GET = withApiErrorHandling(handleGET);
