import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listPlayers } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const limit = parsePositiveInt(req.nextUrl.searchParams.get("limit"), 50, 200);
  const offset = parsePositiveInt(req.nextUrl.searchParams.get("offset"), 0, 100_000);

  const result = await listPlayers({
    search: req.nextUrl.searchParams.get("search") || undefined,
    team: req.nextUrl.searchParams.get("team") || undefined,
    position: req.nextUrl.searchParams.get("position") || undefined,
    positionGroup: req.nextUrl.searchParams.get("position_group") || undefined,
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
