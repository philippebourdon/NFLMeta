import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayoffSupplementalTables } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { id } = await ctx.params;
  const gameId = Number.parseInt(id, 10);
  if (!Number.isFinite(gameId) || gameId <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid id");
  }

  const data = await getPlayoffSupplementalTables(gameId);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "supplemental playoff data not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
