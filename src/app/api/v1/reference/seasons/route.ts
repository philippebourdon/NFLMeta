import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listRawSeasons, parseListParams } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }
  const { limit, offset } = parseListParams(req.nextUrl.searchParams);
  const yearFromRaw = req.nextUrl.searchParams.get("year_from");
  const yearToRaw = req.nextUrl.searchParams.get("year_to");
  const yearFrom = yearFromRaw ? Number.parseInt(yearFromRaw, 10) : null;
  const yearTo = yearToRaw ? Number.parseInt(yearToRaw, 10) : null;
  const result = await listRawSeasons({ yearFrom, yearTo, limit, offset });
  return jsonWithRateLimit(auth, {
    data: result.data,
    meta: { total: result.total, limit, offset, returned: result.data.length, has_more: offset + result.data.length < result.total },
  });
}

export const GET = withApiErrorHandling(handleGET);
