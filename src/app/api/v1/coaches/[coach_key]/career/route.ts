import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildCoachCareerData } from "@/lib/api-coach-data";
import { getCoachProfileData } from "@/lib/coach-browser-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ coach_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { coach_key } = await ctx.params;
  const data = await getCoachProfileData(decodeURIComponent(coach_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "coach not found");
  }

  return jsonWithRateLimit(auth, { data: buildCoachCareerData(data) });
}

export const GET = withApiErrorHandling(handleGET);
