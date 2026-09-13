import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildPlayerBioData, extractFieldValue } from "@/lib/api-slice-data";
import { getPlayerByKey } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key, field } = await ctx.params;
  const player = await getPlayerByKey(decodeURIComponent(player_key));
  if (!player) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  const data = buildPlayerBioData(player as Record<string, unknown>);
  const extracted = extractFieldValue(data, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported player bio field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
