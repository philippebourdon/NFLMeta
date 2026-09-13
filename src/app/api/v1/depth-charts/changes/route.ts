import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { listDepthChartChanges } from "@/lib/depth-chart-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

/** Rejects a non-numeric season rather than letting NaN reach the query. */
function parseSeason(raw: string | null): number | null | "invalid" {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

const CHANGE_TYPES = new Set(["promoted", "demoted", "added", "removed", "replaced"]);

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
  const changeType = params.get("type");
  const days = parseIntQuery(params.get("days"), 0, 0, 365);

  const result = await listDepthChartChanges({
    seasonYear: seasonRaw ? Number.parseInt(seasonRaw, 10) : null,
    team: params.get("team"),
    playerKey: params.get("player_key"),
    changeType: changeType && CHANGE_TYPES.has(changeType) ? changeType : null,
    since: days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null,
    limit: parseIntQuery(params.get("limit"), 100, 1, 500),
    offset: parseIntQuery(params.get("offset"), 0, 0, 1_000_000),
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      season_year: seasonRaw ? Number.parseInt(seasonRaw, 10) : null,
      team: params.get("team") || null,
      type: changeType || null,
      days: days || null,
      total: result.total,
      returned: result.rows.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
