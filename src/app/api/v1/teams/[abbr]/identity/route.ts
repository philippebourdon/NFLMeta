import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildTeamIdentityData } from "@/lib/api-identity-fields";
import { getTeamIdentity } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr } = await ctx.params;
  const data = await getTeamIdentity(abbr);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  return jsonWithRateLimit(auth, { data: buildTeamIdentityData(data) });
}

export const GET = withApiErrorHandling(handleGET);
