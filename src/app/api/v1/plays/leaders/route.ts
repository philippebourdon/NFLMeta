import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import {
  LEADER_DEFAULT_MIN_PLAYS,
  LEADER_ROLES,
  LEADER_SORTS,
  type LeaderRole,
  type LeaderSort,
  listPlayLeaders,
  normalizeSeasonType,
  resolvePlayTeamId,
} from "@/lib/plays-data";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Per-player efficiency leaderboards computed from plays.
 *
 * Distinct from /api/v1/stats/players/*, which serves box-score totals. Nothing
 * in a box score answers "who was the most efficient quarterback per dropback",
 * because EPA, success rate and CPOE are properties of individual plays.
 *
 * Cost to the caller is a page of players -- 50 rows by default -- for a
 * question whose raw inputs are tens of thousands of plays.
 */
async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const params = req.nextUrl.searchParams;

  const seasonYear = parseOptionalInt(params.get("season"));
  if (seasonYear == null) {
    return jsonApiError(
      auth,
      400,
      "invalid_request",
      "season is required. Career-spanning leaderboards would rank across 27 seasons of differing rules and are not offered here.",
    );
  }

  const seasonType = normalizeSeasonType(params.get("season_type"));
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const roleRaw = (params.get("role") || "passer").trim().toLowerCase();
  if (!(LEADER_ROLES as readonly string[]).includes(roleRaw)) {
    return jsonApiError(auth, 400, "invalid_request", `role must be one of ${LEADER_ROLES.join(", ")}`);
  }
  const role = roleRaw as LeaderRole;

  const sortRaw = (params.get("sort") || "epa_per_play").trim().toLowerCase();
  if (!(LEADER_SORTS as readonly string[]).includes(sortRaw)) {
    return jsonApiError(auth, 400, "invalid_request", `sort must be one of ${LEADER_SORTS.join(", ")}`);
  }
  const sort = sortRaw as LeaderSort;

  let teamId: number | undefined;
  const teamRaw = (params.get("team") || "").trim();
  if (teamRaw) {
    const resolved = await resolvePlayTeamId(teamRaw);
    if (!resolved) return jsonApiError(auth, 404, "not_found", "team not found");
    teamId = resolved;
  }

  let opponentId: number | undefined;
  const opponentRaw = (params.get("opponent") || "").trim();
  if (opponentRaw) {
    const resolved = await resolvePlayTeamId(opponentRaw);
    if (!resolved) return jsonApiError(auth, 404, "not_found", "opponent not found");
    opponentId = resolved;
  }

  const weekFrom = parseOptionalInt(params.get("week_from"));
  const weekTo = parseOptionalInt(params.get("week_to"));
  const order = (params.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  // A floor the caller can lower but not remove: an efficiency table with no
  // minimum is topped by whoever threw one pass, which is not a leaderboard.
  const minPlays = parseIntQuery(
    params.get("min_plays"),
    LEADER_DEFAULT_MIN_PLAYS[role],
    1,
    10_000,
  );

  const limit = parseIntQuery(params.get("limit"), 50, 1, 1000);
  const offset = parseIntQuery(params.get("offset"), 0, 0, 100_000);

  const rows = await listPlayLeaders({
    seasonYear,
    seasonType,
    weekFrom,
    weekTo,
    teamId,
    opponentId,
    role,
    minPlays,
    sort,
    order,
    limit: limit + 1,
    offset,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      season: seasonYear,
      season_type: seasonType,
      role,
      sort,
      order,
      min_plays: minPlays,
      limit,
      offset,
      returned: data.length,
      has_more: hasMore,
      // The play population the role is measured over, so a caller can tell
      // why a quarterback's play count is not his pass attempts.
      play_basis:
        role === "passer" ? "dropbacks excluding spikes"
        : role === "rusher" ? "rush attempts excluding kneels"
        : "pass plays targeting the receiver",
      filters: {
        team: teamRaw || null,
        opponent: opponentRaw || null,
        week_from: weekFrom ?? null,
        week_to: weekTo ?? null,
      },
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
