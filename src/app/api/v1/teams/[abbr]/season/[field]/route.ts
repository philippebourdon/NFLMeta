import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildTeamSeasonData, extractFieldValue } from "@/lib/api-slice-data";
import { getTeamProfile } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string; field: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr, field } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const data = await getTeamProfile(abbr, Number.isFinite(season as number) ? season : undefined);
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  const seasonData = buildTeamSeasonData(data);
  const extracted = extractFieldValue(seasonData, field);
  if (!extracted.ok) {
    return jsonApiError(auth, 400, "invalid_field", "unsupported team season field");
  }

  return jsonWithRateLimit(auth, { data: { field, value: extracted.value } });
}

export const GET = withApiErrorHandling(handleGET);
