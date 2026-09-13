import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildPlayerIdentityData } from "@/lib/api-identity-fields";
import { getPlayerByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const player = await getPlayerByKey(decodeURIComponent(player_key));
  if (!player) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  return jsonWithRateLimit(auth, { data: buildPlayerIdentityData(player as Record<string, unknown>) });
}

export const GET = withApiErrorHandling(handleGET);
