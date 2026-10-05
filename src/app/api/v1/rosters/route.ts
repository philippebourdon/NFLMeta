import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getLatestRosterYear, listApiRosterEntries } from "@/lib/customer-api-data";
import { getDataSliceStatus } from "@/lib/data-status";
import { parseWeeklyRosterSelection, WEEKLY_ROSTER_WARNING } from '@/lib/weekly-roster-data';
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function resolveYear(req: NextRequest): Promise<number | null> {
  const raw = req.nextUrl.searchParams.get("year") || req.nextUrl.searchParams.get("season");
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return getLatestRosterYear();
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  let weekly;
  try { weekly = parseWeeklyRosterSelection(req.nextUrl.searchParams); }
  catch (error) { return jsonApiError(auth,400,'invalid_request',(error as Error).message); }
  const year = await resolveYear(req);
  if (!year) {
    return jsonApiError(auth, 400, "invalid_request", "valid year is required");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 100, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 1_000_000);
  const team = req.nextUrl.searchParams.get("team") || undefined;
  const withCount = req.nextUrl.searchParams.get("count") === "true";
  const result = await listApiRosterEntries({
    year,
    ...(weekly ? {week:weekly.week,seasonType:weekly.seasonType} : {}),
    team,
    status: req.nextUrl.searchParams.get("status") || undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    search: req.nextUrl.searchParams.get("search") || req.nextUrl.searchParams.get("q") || undefined,
    limit,
    offset,
    withCount,
  });
  const dataStatus = weekly ? null : await getDataSliceStatus({
    datasetKey: "rosters",
    seasonYear: year,
    teamAbbr: team,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      year,
      ...(weekly ? {week:weekly.week,season_type:weekly.seasonType,snapshot_kind:'weekly_history',pre_kickoff_verified:false,warnings:[WEEKLY_ROSTER_WARNING]} : {}),
      team: team || null,
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: result.hasMore,
      data_status: dataStatus,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
