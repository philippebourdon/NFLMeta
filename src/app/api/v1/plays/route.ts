import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { resolveCanonicalPlayerKey } from "@/lib/player-key-aliases";
import {
  PLAY_ROLES,
  type PlayRole,
  listPlays,
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
 * Raw plays, and only for a slice the caller has actually narrowed.
 *
 * The refusal below is not an anti-abuse measure. Callers are metered in rows
 * per month and one season is ~47,000 of them, so an unfiltered request is a
 * request to spend a chunk of somebody's allowance on an arbitrary hundred
 * plays out of 1.28 million -- which answers no question and cannot be paged
 * to completion anyway, because the plan's result window stops well short of
 * the end. Refusing costs the caller nothing (an error envelope is not billed)
 * and the message says what to add.
 *
 * /api/v1/plays/summary and /api/v1/plays/leaders exist for the questions that
 * would otherwise motivate a bulk pull.
 */
async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const params = req.nextUrl.searchParams;

  const gameId = parseOptionalInt(params.get("game_id"));
  if (params.get("game_id") && gameId == null) {
    return jsonApiError(auth, 400, "invalid_request", "invalid game_id");
  }

  const seasonYear = parseOptionalInt(params.get("season"));
  if (params.get("season") && seasonYear == null) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }

  const week = parseOptionalInt(params.get("week"));
  const seasonType = normalizeSeasonType(params.get("season_type"));
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const roleRaw = (params.get("role") || "any").trim().toLowerCase();
  if (!(PLAY_ROLES as readonly string[]).includes(roleRaw)) {
    return jsonApiError(auth, 400, "invalid_request", `role must be one of ${PLAY_ROLES.join(", ")}`);
  }
  const role = roleRaw as PlayRole;

  let playerKey: string | undefined;
  const playerRaw = (params.get("player") || "").trim();
  if (playerRaw) {
    const resolved = await resolveCanonicalPlayerKey(playerRaw);
    if (!resolved) {
      return jsonApiError(auth, 404, "not_found", "player not found");
    }
    playerKey = resolved;
  }

  let teamId: number | undefined;
  const teamRaw = (params.get("team") || "").trim();
  if (teamRaw) {
    const resolved = await resolvePlayTeamId(teamRaw);
    if (!resolved) {
      return jsonApiError(auth, 404, "not_found", "team not found");
    }
    teamId = resolved;
  }

  let opponentId: number | undefined;
  const opponentRaw = (params.get("opponent") || "").trim();
  if (opponentRaw) {
    const resolved = await resolvePlayTeamId(opponentRaw);
    if (!resolved) {
      return jsonApiError(auth, 404, "not_found", "opponent not found");
    }
    opponentId = resolved;
  }

  // A slice is narrow enough when it is one game, one player, or a season
  // combined with a week or a team. Anything less is a scan of the corpus.
  const narrowedByGame = gameId != null;
  const narrowedByPlayer = playerKey != null;
  const narrowedBySeason =
    seasonYear != null && (week != null || teamId != null || opponentId != null);
  if (!narrowedByGame && !narrowedByPlayer && !narrowedBySeason) {
    return jsonApiError(
      auth,
      400,
      "invalid_request",
      "a narrowing filter is required: pass game_id, or player, or season with one of week, team, or opponent. "
      + "Use /api/v1/plays/summary or /api/v1/plays/leaders for league-wide questions.",
    );
  }

  const playType = (params.get("play_type") || "").trim().toLowerCase() || undefined;
  const down = parseOptionalInt(params.get("down"));
  if (down != null && (down < 1 || down > 4)) {
    return jsonApiError(auth, 400, "invalid_request", "down must be 1-4");
  }
  const quarter = parseOptionalInt(params.get("quarter"));
  if (quarter != null && (quarter < 1 || quarter > 6)) {
    return jsonApiError(auth, 400, "invalid_request", "quarter must be 1-6");
  }
  const redZone = (params.get("red_zone") || "").toLowerCase() === "true";
  const skipMarkers = (params.get("skip_markers") || "").toLowerCase() === "true";
  const order = (params.get("order") || "asc").toLowerCase() === "desc" ? "desc" : "asc";

  const limit = parseIntQuery(params.get("limit"), 50, 1, 1000);
  const offset = parseIntQuery(params.get("offset"), 0, 0, 1_000_000);

  const rows = await listPlays({
    gameId,
    seasonYear,
    seasonType,
    week,
    teamId,
    opponentId,
    playerKey,
    role,
    playType,
    down,
    quarter,
    redZone,
    skipMarkers,
    order,
    limit: limit + 1,
    offset,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      limit,
      offset,
      returned: data.length,
      has_more: hasMore,
      order,
      season_type: seasonType,
      filters: {
        game_id: gameId ?? null,
        season: seasonYear ?? null,
        week: week ?? null,
        team: teamRaw || null,
        opponent: opponentRaw || null,
        player: playerKey ?? null,
        role: playerKey ? role : null,
        play_type: playType ?? null,
        down: down ?? null,
        quarter: quarter ?? null,
        red_zone: redZone,
        skip_markers: skipMarkers,
      },
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
