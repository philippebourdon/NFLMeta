import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildContributorBioData, getContributorProfileData } from "@/lib/api-contributor-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ contributor_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { contributor_key } = await ctx.params;
  const data = await getContributorProfileData(decodeURIComponent(contributor_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "contributor not found");
  }

  return jsonWithRateLimit(auth, { data: buildContributorBioData(data) });
}

export const GET = withApiErrorHandling(handleGET);
