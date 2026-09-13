import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getPlayoffGameDetails } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ id: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { id, field } = await ctx.params;
  const gameId = Number.parseInt(id, 10);
  if (!Number.isFinite(gameId) || gameId <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid id");
  }

  const result = await getPlayoffGameDetails(gameId);
  if (result.kind === "error") {
    return jsonApiError(auth, result.status, "not_found", result.body.error);
  }

  const extracted = extractFieldValue(result.body as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported playoff game detail field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
