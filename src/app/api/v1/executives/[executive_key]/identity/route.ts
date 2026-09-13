import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildExecutiveIdentityData, getExecutiveProfileData } from "@/lib/api-executive-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ executive_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { executive_key } = await ctx.params;
  const data = await getExecutiveProfileData(decodeURIComponent(executive_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "executive not found");
  }

  return jsonWithRateLimit(auth, { data: buildExecutiveIdentityData(data) });
}

export const GET = withApiErrorHandling(handleGET);
