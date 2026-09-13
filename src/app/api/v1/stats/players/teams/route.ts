import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listPlayerTeamStints } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOptionalNumber(value: string | null) {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 50, 1, 500);
  const offset = parseIntQuery(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);
  const result = await listPlayerTeamStints({
    search: req.nextUrl.searchParams.get("search") || undefined,
    team: req.nextUrl.searchParams.get("team") || undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    stat: req.nextUrl.searchParams.get("stat") || undefined,
    minValue: parseOptionalNumber(req.nextUrl.searchParams.get("min_value")),
    limit,
    offset,
  });

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      total: result.total,
      limit,
      offset,
      returned: result.rows.length,
      has_more: offset + result.rows.length < result.total,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
