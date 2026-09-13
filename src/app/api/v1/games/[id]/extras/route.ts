import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getGameDetails, getRegularGameExtras, resolveCanonicalRegularGameId } from "@/lib/public-data";
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

  const detail = await getGameDetails(gameId);
  if (detail.kind === "error") {
    return jsonApiError(auth, detail.status, "not_found", detail.body.error);
  }

  if ((detail.body as { is_playoff?: boolean }).is_playoff) {
    return jsonApiError(auth, 400, "invalid_request", "use /api/v1/playoff-games/{id}/extras for playoff games");
  }

  const canonicalId = await resolveCanonicalRegularGameId(gameId);
  const extras = await getRegularGameExtras(canonicalId);

  return jsonWithRateLimit(auth, { data: extras, meta: { canonical_game_id: canonicalId } });
}

export const GET = withApiErrorHandling(handleGET);
