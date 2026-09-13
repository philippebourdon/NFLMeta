import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getSuperBowlTeamRecord } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr } = await ctx.params;
  const record = await getSuperBowlTeamRecord(abbr);
  if (!record) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  return jsonWithRateLimit(auth, { data: record });
}

export const GET = withApiErrorHandling(handleGET);
