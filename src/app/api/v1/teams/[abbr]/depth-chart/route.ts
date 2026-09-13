import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getDataSliceStatus } from "@/lib/data-status";
import { getDepthChartCurrency, listDepthChart } from "@/lib/depth-chart-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

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
  const currency = seasonRaw ? null : await getDepthChartCurrency();
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : currency?.seasonYear ?? null;

  const result = await listDepthChart({
    seasonYear,
    team: abbr,
    positionGroup: params.get("position_group"),
    position: params.get("position"),
    startersOnly: params.get("starters") === "true",
    limit: 1000,
    offset: 0,
  });

  // Group by the personnel package a club actually lists, so a consumer can
  // render the chart the way the team publishes it.
  const grouped: Record<string, typeof result.rows> = {};
  for (const row of result.rows) {
    (grouped[row.position_group] ||= []).push(row);
  }

  const dataStatus = await getDataSliceStatus({
    datasetKey: "depth_charts",
    seasonYear,
    teamAbbr: abbr,
  });

  return jsonWithRateLimit(auth, {
    data: { groups: grouped, entries: result.rows },
    meta: {
      team: abbr.toUpperCase(),
      season_year: seasonYear,
      captured_at: result.rows[0]?.captured_at ?? currency?.capturedAt ?? null,
      returned: result.rows.length,
      data_status: dataStatus,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
