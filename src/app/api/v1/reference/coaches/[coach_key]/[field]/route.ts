import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getRawCoach } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ coach_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { coach_key, field } = await ctx.params;
  const data = await getRawCoach(decodeURIComponent(coach_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "coach not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported coach field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
