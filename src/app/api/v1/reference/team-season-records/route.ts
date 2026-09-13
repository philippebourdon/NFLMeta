import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listRawTeamSeasonRecords, parseListParams } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }
  const { limit, offset } = parseListParams(req.nextUrl.searchParams);
  const team = (req.nextUrl.searchParams.get("team") || "").trim().toUpperCase();
  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const result = await listRawTeamSeasonRecords({ team: team || undefined, year, limit, offset });
  return jsonWithRateLimit(auth, {
    data: result.data,
    meta: { total: result.total, limit, offset, returned: result.data.length, has_more: offset + result.data.length < result.total },
  });
}

export const GET = withApiErrorHandling(handleGET);
