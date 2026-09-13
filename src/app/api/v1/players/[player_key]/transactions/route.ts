import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { listPlayerTransactions } from "@/lib/transaction-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseSeason(raw: string | null): number | null | "invalid" {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

async function handleGET(req: NextRequest, context: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { player_key: playerKey } = await context.params;
  const season = parseSeason(req.nextUrl.searchParams.get("season") || req.nextUrl.searchParams.get("year"));
  if (season === "invalid") {
    return jsonApiError(auth, 400, "invalid_request", "season must be a valid year");
  }

  const result = await listPlayerTransactions({
    playerKey: decodeURIComponent(playerKey),
    seasonYear: season,
    limit: 500,
    offset: 0,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      player_key: decodeURIComponent(playerKey),
      season_year: season,
      total: result.total,
      returned: result.rows.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
