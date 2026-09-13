import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getRawOfficial } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ official_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }
  const { official_key } = await ctx.params;
  const data = await getRawOfficial(decodeURIComponent(official_key));
  if (!data) return jsonApiError(auth, 404, "not_found", "official not found");
  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
