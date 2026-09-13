import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getDataSliceStatus } from "@/lib/data-status";
import { findTeamByAbbr, listGames } from "@/lib/public-data";
import { parseDate } from "@/lib/metadata-api";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const seasonRaw = req.nextUrl.searchParams.get("season");
  const weekRaw = req.nextUrl.searchParams.get("week");
  const teamRaw = (req.nextUrl.searchParams.get("team") || "").trim();
  const dateRaw = req.nextUrl.searchParams.get("date");
  const orderRaw = (req.nextUrl.searchParams.get("order") || "desc").toLowerCase();
  const includePlayoffsRaw = (req.nextUrl.searchParams.get("include_playoffs") || "true").toLowerCase();

  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const week = weekRaw ? Number.parseInt(weekRaw, 10) : undefined;
  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 50, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);
  const parsedDate = dateRaw ? parseDate(dateRaw) : null;

  if (dateRaw && !parsedDate) {
    return jsonApiError(auth, 400, "invalid_request", "invalid date");
  }

  let teamId: number | undefined;
  if (teamRaw) {
    if (/^\d+$/.test(teamRaw)) {
      const parsed = Number.parseInt(teamRaw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        teamId = parsed;
      }
    } else {
      const team = await findTeamByAbbr(teamRaw);
      if (!team) {
        return jsonApiError(auth, 404, "not_found", "team not found");
      }
      teamId = team.id;
    }
  }

  const order = orderRaw === "asc" ? "asc" : "desc";
  const includePlayoffs = includePlayoffsRaw !== "false";

  const rows = await listGames({
    seasonYear: Number.isFinite(season as number) ? season : undefined,
    week: Number.isFinite(week as number) ? week : undefined,
    teamId,
    date: parsedDate || undefined,
    order,
    limit: limit + 1,
    offset,
    includePlayoffs,
  });

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const dataStatus = Number.isFinite(season as number)
    ? await getDataSliceStatus({
      datasetKey: "schedules",
      seasonYear: season,
      week: Number.isFinite(week as number) ? week : null,
      teamAbbr: teamRaw || null,
    })
    : null;

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      limit,
      offset,
      returned: data.length,
      has_more: hasMore,
      order,
      include_playoffs: includePlayoffs,
      data_status: dataStatus,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
