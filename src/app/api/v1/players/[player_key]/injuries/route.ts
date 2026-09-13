import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { listInjuryReports } from "@/lib/injury-data";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { getCurrentReserves } from '@/lib/current-reserves';

/** Rejects a non-numeric season rather than letting NaN reach the query. */
function parseSeason(raw: string | null): number | null | "invalid" {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

async function handleGET(req: NextRequest, context: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { player_key: playerKey } = await context.params;
  const params = req.nextUrl.searchParams;
  const seasonParsed = parseSeason(params.get("season") || params.get("year"));
  if (seasonParsed === "invalid") return jsonApiError(auth, 400, "invalid_request", "season must be a valid year");
  const seasonRaw = seasonParsed === null ? null : String(seasonParsed);

  const result = await listInjuryReports({
    playerKey: decodeURIComponent(playerKey),
    seasonYear: seasonRaw ? Number.parseInt(seasonRaw, 10) : null,
    limit: 500,
    offset: 0,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      current_reserves: await getCurrentReserves(null, decodeURIComponent(playerKey)),
      player_key: decodeURIComponent(playerKey),
      season_year: seasonRaw ? Number.parseInt(seasonRaw, 10) : null,
      returned: result.rows.length,
      total: result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
