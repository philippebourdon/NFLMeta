import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { resolveCanonicalPlayerKey } from "@/lib/player-key-aliases";
import {
  SUMMARY_GROUPINGS,
  type SummaryGrouping,
  normalizeSeasonType,
  resolvePlayTeamId,
  summarizePlays,
} from "@/lib/plays-data";

function parseOptionalInt(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Efficiency aggregates over a slice of plays.
 *
 * This is the endpoint most callers should be using, and the reason is money.
 * "Which offence was most efficient in 2024" is 47,000 plays if you download
 * them and average them yourself; here it is 32 rows. A free key gets 25,000
 * rows a month, so the first version is impossible on that plan and the second
 * costs 0.13% of it.
 *
 * The aggregation runs against indexed season and team slices rather than a
 * pre-built rollup table, so a summary can never disagree with the plays it
 * summarises, and a new grouping needs no backfill.
 */
async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const params = req.nextUrl.searchParams;

  const seasonYear = parseOptionalInt(params.get("season"));
  const gameId = parseOptionalInt(params.get("game_id"));
  const seasonFrom = parseOptionalInt(params.get("season_from"));
  const seasonTo = parseOptionalInt(params.get("season_to"));
  const hasSeasonRange = seasonFrom != null && seasonTo != null;
  if (seasonYear == null && gameId == null && !hasSeasonRange) {
    return jsonApiError(
      auth,
      400,
      "invalid_request",
      "a season scope is required: pass season, or game_id, or both season_from and season_to. "
      + "season_from/season_to with group_by=season is how you compare eras -- every season held is 27 rows.",
    );
  }
  if (hasSeasonRange && seasonTo < seasonFrom) {
    return jsonApiError(auth, 400, "invalid_request", "season_to must not be earlier than season_from");
  }

  const seasonType = normalizeSeasonType(params.get("season_type"));
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const groupByRaw = (params.get("group_by") || "team").trim().toLowerCase();
  if (!(SUMMARY_GROUPINGS as readonly string[]).includes(groupByRaw)) {
    return jsonApiError(auth, 400, "invalid_request", `group_by must be one of ${SUMMARY_GROUPINGS.join(", ")}`);
  }
  const groupBy = groupByRaw as SummaryGrouping;

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

  let playerKey: string | undefined;
  const playerRaw = (params.get("player") || "").trim();
  if (playerRaw) {
    const resolved = await resolveCanonicalPlayerKey(playerRaw);
    if (!resolved) return jsonApiError(auth, 404, "not_found", "player not found");
    playerKey = resolved;
  }

  const week = parseOptionalInt(params.get("week"));
  const down = parseOptionalInt(params.get("down"));
  if (down != null && (down < 1 || down > 4)) {
    return jsonApiError(auth, 400, "invalid_request", "down must be 1-4");
  }
  const quarter = parseOptionalInt(params.get("quarter"));
  if (quarter != null && (quarter < 1 || quarter > 6)) {
    return jsonApiError(auth, 400, "invalid_request", "quarter must be 1-6");
  }
  const playType = (params.get("play_type") || "").trim().toLowerCase() || undefined;
  const redZone = (params.get("red_zone") || "").toLowerCase() === "true";

  // A grouping is bounded by the domain it groups on -- 32 teams, 4 downs, 22
  // weeks -- except group_by=game, which is why there is a ceiling at all. It
  // is clamped further by the plan's page size before this route ever sees it.
  const requestedLimit = Number.parseInt(params.get("limit") || "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(500, Math.max(1, requestedLimit))
    : 100;

  const rows = await summarizePlays({
    gameId,
    seasonYear,
    seasonFrom: hasSeasonRange ? seasonFrom : undefined,
    seasonTo: hasSeasonRange ? seasonTo : undefined,
    seasonType,
    week,
    teamId,
    opponentId,
    playerKey,
    playType,
    down,
    quarter,
    redZone,
    groupBy,
    limit,
  });

  return jsonWithRateLimit(auth, {
    data: rows,
    meta: {
      group_by: groupBy,
      returned: rows.length,
      season: seasonYear ?? null,
      season_from: hasSeasonRange ? seasonFrom : null,
      season_to: hasSeasonRange ? seasonTo : null,
      game_id: gameId ?? null,
      season_type: seasonType,
      // Rates cover pass and run plays only; kneels and spikes are excluded.
      // Stated in the payload because an EPA-per-play that silently included
      // punts would be wrong in a way nobody would notice.
      rate_basis: "scrimmage_plays",
      filters: {
        team: teamRaw || null,
        opponent: opponentRaw || null,
        player: playerKey ?? null,
        week: week ?? null,
        down: down ?? null,
        quarter: quarter ?? null,
        play_type: playType ?? null,
        red_zone: redZone,
      },
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
