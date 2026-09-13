import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getTeamHistoryByAbbr } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr } = await ctx.params;
  const data = await getTeamHistoryByAbbr(abbr);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
