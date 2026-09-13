import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildPlayerIdentityData, isPlayerIdentityField } from "@/lib/api-identity-fields";
import { getPlayerByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(
  req: NextRequest,
  ctx: { params: Promise<{ player_key: string; field: string }> },
) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, field } = await ctx.params;
  if (!isPlayerIdentityField(field)) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player identity field");
  }

  const player = await getPlayerByKey(decodeURIComponent(player_key));
  if (!player) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  const identity = buildPlayerIdentityData(player as Record<string, unknown>);
  return jsonWithRateLimit(auth, { data: { field, value: identity[field] ?? null } });
}

export const GET = withApiErrorHandling(handleGET);
