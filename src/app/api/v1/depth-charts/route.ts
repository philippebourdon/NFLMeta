import { depthChartQuality } from "@/lib/depth-chart-quality";
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
  const currency = seasonRaw ? null : await getDepthChartCurrency();
  const seasonYear = seasonRaw ? Number.parseInt(seasonRaw, 10) : currency?.seasonYear ?? null;

  const team = params.get("team");
  const limit = parseIntQuery(params.get("limit"), 100, 1, 1000);
  const offset = parseIntQuery(params.get("offset"), 0, 0, 1_000_000);

  const result = await listDepthChart({
    seasonYear,
    team,
    positionGroup: params.get("position_group"),
    position: params.get("position"),
    startersOnly: params.get("starters") === "true",
    limit,
    offset,
  });

  const dataStatus = await getDataSliceStatus({
    datasetKey: "depth_charts",
    seasonYear,
    teamAbbr: team,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      season_year: seasonYear,
      team: team || null,
      // Depth charts move daily, so say when this one was captured upstream
      // rather than leaving a consumer to assume it is live.
      captured_at: result.rows[0]?.captured_at ?? currency?.capturedAt ?? null,
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
      data_status: dataStatus,
      quality: depthChartQuality(result.rows),
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
