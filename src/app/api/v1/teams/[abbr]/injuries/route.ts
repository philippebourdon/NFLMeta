import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getDataSliceStatus } from "@/lib/data-status";
import { getLatestInjuryWeek, listInjuryReports } from "@/lib/injury-data";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { getCurrentReserves } from '@/lib/current-reserves';

/** Rejects a non-numeric season rather than letting NaN reach the query. */
function parseSeason(raw: string | null): number | null | "invalid" {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

async function handleGET(req: NextRequest, context: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { abbr } = await context.params;
  const params = req.nextUrl.searchParams;
  const seasonParsed = parseSeason(params.get("season") || params.get("year"));
  if (seasonParsed === "invalid") return jsonApiError(auth, 400, "invalid_request", "season must be a valid year");
  const seasonRaw = seasonParsed === null ? null : String(seasonParsed);
  const weekRaw = params.get("week");

  const latest = seasonRaw ? null : await getLatestInjuryWeek();
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : latest?.seasonYear ?? null;
  const week = weekRaw ? Number.parseInt(weekRaw, 10) : seasonRaw ? null : latest?.week ?? null;

  const result = await listInjuryReports({
    seasonYear,
    week,
    team: abbr,
    status: params.get("status"),
    limit: 500,
    offset: 0,
  });

  const dataStatus = await getDataSliceStatus({
    datasetKey: "injuries",
    seasonYear,
    teamAbbr: abbr,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      current_reserves: await getCurrentReserves(abbr),
      team: abbr.toUpperCase(),
      season_year: seasonYear,
      week,
      returned: result.rows.length,
      total: result.total,
      data_status: dataStatus,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
