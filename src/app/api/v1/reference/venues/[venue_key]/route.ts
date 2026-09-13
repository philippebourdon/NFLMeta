import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getRawVenue } from "@/lib/reference-raw-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ venue_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }
  const { venue_key } = await ctx.params;
  const data = await getRawVenue(decodeURIComponent(venue_key));
  if (!data) return jsonApiError(auth, 404, "not_found", "venue not found");
  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
