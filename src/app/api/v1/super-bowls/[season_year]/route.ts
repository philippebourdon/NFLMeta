import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getSuperBowlBySeason } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ season_year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { season_year } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear) || seasonYear <= 0) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season");
  }

  const row = await getSuperBowlBySeason(seasonYear);
  if (!row) {
    return jsonApiError(auth, 404, "not_found", "super bowl not found");
  }

  return jsonWithRateLimit(auth, { data: row });
}

export const GET = withApiErrorHandling(handleGET);
