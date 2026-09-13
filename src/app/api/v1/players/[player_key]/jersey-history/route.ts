import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerJerseyHistoryByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { player_key } = await ctx.params;
  const result = await getPlayerJerseyHistoryByKey(decodeURIComponent(player_key));
  if (!result) return jsonApiError(auth, 404, "not_found", "player not found");

  return jsonWithRateLimit(auth, {
    data: result.rows,
    meta: {
      player_key: result.player_key,
      display_name: result.display_name,
      total: result.rows.length,
      returned: result.rows.length,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
