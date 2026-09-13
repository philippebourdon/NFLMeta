import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { extractFieldValue } from "@/lib/api-slice-data";
import { getHallOfFameElectionYear } from "@/lib/api-hall-of-fame-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ election_year: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { election_year, field } = await ctx.params;
  const year = Number.parseInt(election_year, 10);
  if (!Number.isFinite(year)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid election year");
  }

  const data = await getHallOfFameElectionYear(year);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "hall of fame election year not found");
  }

  const extracted = extractFieldValue(data as Record<string, unknown>, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported hall of fame field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
