import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getByeWeeksPayload } from "@/lib/metadata-api";
import { isPublicSeasonYear } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { year } = await ctx.params;
  const seasonYear = Number.parseInt(year, 10);
  if (!Number.isFinite(seasonYear) || seasonYear <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }
  if (!(await isPublicSeasonYear(seasonYear))) {
    return jsonApiError(auth, 404, "not_found", "bye weeks not found");
  }

  const result = await getByeWeeksPayload(seasonYear);
  if (result.kind === "error") {
    return jsonApiError(auth, result.status, "not_found", result.body.error);
  }

  return jsonWithRateLimit(auth, { data: result.body });
}

export const GET = withApiErrorHandling(handleGET);
