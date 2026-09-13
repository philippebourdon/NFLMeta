import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonWithRateLimit } from "@/lib/api-key";
import { listRawTeams, parseListParams } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }
  const { limit, offset } = parseListParams(req.nextUrl.searchParams);
  const conference = (req.nextUrl.searchParams.get("conference") || "").trim().toUpperCase();
  const division = (req.nextUrl.searchParams.get("division") || "").trim().toUpperCase();
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const result = await listRawTeams({ conference: conference || undefined, division: division || undefined, q: q || undefined, limit, offset });
  return jsonWithRateLimit(auth, {
    data: result.data,
    meta: { total: result.total, limit, offset, returned: result.data.length, has_more: offset + result.data.length < result.total },
  });
}

export const GET = withApiErrorHandling(handleGET);
