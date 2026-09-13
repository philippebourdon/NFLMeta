import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { isAllowedPlayerGameStat, listPlayerWeeklyLeaders } from "@/lib/raw-api-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ season_year: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { season_year } = await ctx.params;
  const seasonYear = Number.parseInt(season_year, 10);
  if (!Number.isFinite(seasonYear)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid season_year");
  }

  const stat = (req.nextUrl.searchParams.get("stat") || "").trim().toLowerCase();
  if (!stat || !isAllowedPlayerGameStat(stat)) {
    return jsonApiError(auth, 400, "invalid_request", "invalid stat");
  }

  const seasonTypeRaw = (req.nextUrl.searchParams.get("season_type") || "ALL").trim().toUpperCase();
  const seasonType = seasonTypeRaw === "REG" || seasonTypeRaw === "POST" || seasonTypeRaw === "ALL" ? seasonTypeRaw : null;
  if (!seasonType) {
    return jsonApiError(auth, 400, "invalid_request", "season_type must be REG, POST, or ALL");
  }

  const limitPerWeek = Number.parseInt(req.nextUrl.searchParams.get("limit_per_week") || "10", 10);
  const data = await listPlayerWeeklyLeaders({ seasonYear, seasonType, stat, limitPerWeek });
  return jsonWithRateLimit(auth, { data });
}

export const GET = withApiErrorHandling(handleGET);
