import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { listRawVenues, parseListParams } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { limit, offset } = parseListParams(req.nextUrl.searchParams);
  const q = (req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
  const team = (req.nextUrl.searchParams.get("team") || "").trim().toUpperCase();
  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const result = await listRawVenues({ q: q || undefined, team: team || undefined, year, limit, offset });
  if ("unknownTeam" in result && result.unknownTeam) {
    return jsonApiError(auth, 400, "invalid_request", `unknown team: ${team}`);
  }

  return jsonWithRateLimit(auth, {
    data: result.data,
    meta: { total: result.total, limit, offset, returned: result.data.length, has_more: offset + result.data.length < result.total },
  });
}

export const GET = withApiErrorHandling(handleGET);
