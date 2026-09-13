import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerCareerStatSeasonsByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { seasonDataUnavailableMessage } from "@/lib/data-availability-message";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const limit = parsePositiveInt(req.nextUrl.searchParams.get("limit"), 50, 500);
  const offset = parsePositiveInt(req.nextUrl.searchParams.get("offset"), 0, 100_000);
  const seasonRaw = (req.nextUrl.searchParams.get("season") || "").trim();
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  if (seasonRaw && (!/^\d{4}$/.test(seasonRaw) || !season || season < 1920 || season > new Date().getUTCFullYear())) {
    return jsonApiError(auth, 400, "invalid_request", "season must be a four-digit NFL season from 1920 through the current year");
  }
  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "").trim().toUpperCase();
  const seasonType = seasonTypeRaw ? seasonTypeRaw : undefined;
  if (seasonType && seasonType !== "REG" && seasonType !== "POST") {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG or POST");
  }

  const decodedPlayerKey = decodeURIComponent(player_key);
  const result = await getPlayerCareerStatSeasonsByKey(decodedPlayerKey, {
    season,
    seasonType,
    limit,
    offset,
  });

  if (!result.total) {
    if (season) {
      const available = await getPlayerCareerStatSeasonsByKey(decodedPlayerKey, { limit: 1, offset: 0 });
      const latestAvailableSeason = Number((available.rows[0] as Record<string, unknown> | undefined)?.season_year);
      if (Number.isFinite(latestAvailableSeason)) {
        return jsonApiError(auth, 404, "not_found", seasonDataUnavailableMessage({
          requestedSeason: season,
          seasonType,
          latestAvailableSeason,
        }));
      }
    }
    return jsonApiError(auth, 404, "not_found", "player career stat seasons not found");
  }

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
