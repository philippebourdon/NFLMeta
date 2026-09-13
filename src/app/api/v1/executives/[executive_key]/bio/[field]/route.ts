import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildExecutiveBioData, getExecutiveProfileData } from "@/lib/api-executive-data";
import { extractFieldValue } from "@/lib/api-slice-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ executive_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { executive_key, field } = await ctx.params;
  const data = await getExecutiveProfileData(decodeURIComponent(executive_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "executive not found");
  }

  const extracted = extractFieldValue(buildExecutiveBioData(data) as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported executive bio field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
