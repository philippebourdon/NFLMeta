import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildPlayerHonorsData } from "@/lib/api-slice-data";
import { getPlayerProfileData } from "@/lib/player-profile-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const data = await getPlayerProfileData(decodeURIComponent(player_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  return jsonWithRateLimit(auth, { data: buildPlayerHonorsData(data) });
}

export const GET = withApiErrorHandling(handleGET);
