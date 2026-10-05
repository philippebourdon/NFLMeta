import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getDataSliceStatus } from "@/lib/data-status";
import { getLatestInjuryWeek, listInjuryReports } from "@/lib/injury-data";
import { withApiErrorHandling } from "@/lib/api-route-error";
import { getCurrentReserves } from '@/lib/current-reserves';
import { parseInjuryPracticeDate } from '@/lib/injury-practice-date';

/** Rejects a non-numeric season rather than letting NaN reach the query. */
function parseSeason(raw: string | null): number | null | "invalid" {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const params = req.nextUrl.searchParams;
  const seasonParsed = parseSeason(params.get("season") || params.get("year"));
  if (seasonParsed === "invalid") return jsonApiError(auth, 400, "invalid_request", "season must be a valid year");
  const seasonRaw = seasonParsed === null ? null : String(seasonParsed);
  const weekRaw = params.get("week");
  const practiceDate = parseInjuryPracticeDate(params.get("date"));
  if (practiceDate === 'invalid') return jsonApiError(auth, 400, "invalid_request", "date must be a valid YYYY-MM-DD date");

  // With no season given, default to the newest week on file rather than
  // paging through every season ever reported.
  const latest = await getLatestInjuryWeek();
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : practiceDate ? null : latest?.seasonYear ?? null;
  const week = weekRaw
    ? Number.parseInt(weekRaw, 10)
    : seasonRaw
      ? null
      : practiceDate ? null : latest?.week ?? null;

  const team = params.get("team");
  const limit = parseIntQuery(params.get("limit"), 100, 1, 500);
  const offset = parseIntQuery(params.get("offset"), 0, 0, 1_000_000);

  const result = await listInjuryReports({
    seasonYear,
    week,
    practiceDate,
    team,
    status: params.get("status"),
    limit,
    offset,
  });

  const dataStatus = await getDataSliceStatus({
    datasetKey: "injuries",
    seasonYear,
    teamAbbr: team,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      current_reserves: await getCurrentReserves(team),
      season_year: seasonYear,
      week,
      date: practiceDate,
      team: team || null,
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
      data_status: dataStatus,
    },
  }, undefined, { excludeCurrentReserves: true });
}

export const GET = withApiErrorHandling(handleGET);
