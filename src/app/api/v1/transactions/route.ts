import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getDataSliceStatus } from "@/lib/data-status";
import { listPlayerTransactions, TRANSACTION_EVENT_TYPES } from "@/lib/transaction-data";
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
  const season = parseSeason(params.get("season") || params.get("year"));
  if (season === "invalid") {
    return jsonApiError(auth, 400, "invalid_request", "season must be a valid year");
  }

  const eventType = params.get("type");
  if (eventType && !(TRANSACTION_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return jsonApiError(
      auth,
      400,
      "invalid_request",
      `type must be one of: ${TRANSACTION_EVENT_TYPES.join(", ")}`,
    );
  }

  const days = parseIntQuery(params.get("days"), 0, 0, 3650);
  const team = params.get("team");

  const result = await listPlayerTransactions({
    seasonYear: season,
    team,
    eventType,
    since: days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) : null,
    limit: parseIntQuery(params.get("limit"), 100, 1, 500),
    offset: parseIntQuery(params.get("offset"), 0, 0, 1_000_000),
  });

  const dataStatus = await getDataSliceStatus({
    datasetKey: "transactions",
    seasonYear: season,
    teamAbbr: team,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      season_year: season,
      team: team || null,
      type: eventType || null,
      days: days || null,
      total: result.total,
      returned: result.rows.length,
      data_status: dataStatus,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
