import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildContributorIdentityData, getContributorProfileData } from "@/lib/api-contributor-data";
import { extractFieldValue } from "@/lib/api-slice-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ contributor_key: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { contributor_key, field } = await ctx.params;
  const data = await getContributorProfileData(decodeURIComponent(contributor_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "contributor not found");
  }

  const extracted = extractFieldValue(buildContributorIdentityData(data) as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported contributor identity field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
