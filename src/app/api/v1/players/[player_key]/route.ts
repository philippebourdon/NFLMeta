import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  const data = await getPlayerByKey(decodeURIComponent(player_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  return jsonWithRateLimit(auth, { data, meta: { identity: {
    requested_player_key: decodeURIComponent(player_key),
    canonical_player_key: data.player_key,
    resolved_alias: decodeURIComponent(player_key).trim() !== data.player_key,
  } } });
}

export const GET = withApiErrorHandling(handleGET);
