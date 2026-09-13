import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getHallOfFameElectionYear } from "@/lib/api-hall-of-fame-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ election_year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { election_year } = await ctx.params;
  const year = Number.parseInt(election_year, 10);
  if (!Number.isFinite(year)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid election year");
  }

  const data = await getHallOfFameElectionYear(year);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "hall of fame election year not found");
  }

  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
