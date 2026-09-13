import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildPlayerHonorsData, extractFieldValue } from "@/lib/api-slice-data";
import { getPlayerProfileData } from "@/lib/player-profile-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, field } = await ctx.params;
  const data = await getPlayerProfileData(decodeURIComponent(player_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  const honors = buildPlayerHonorsData(data);
  const extracted = extractFieldValue(honors, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player honors field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
