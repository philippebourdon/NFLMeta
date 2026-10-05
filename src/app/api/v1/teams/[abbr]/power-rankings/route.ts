import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { buildTeamPowerRankingsData, filterTeamPowerRankingsData, parsePowerRankingSource } from "@/lib/api-slice-data";
import { getTeamProfile } from "@/lib/public-data";
import { getTeamProfileExtras } from "@/lib/team-profile-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const source = parsePowerRankingSource(req.nextUrl.searchParams.get("source"));
  if (!source.ok) {
    return jsonApiError(auth, 400, "invalid_request", "source must be cbs, espn, or nfl");
  }

  const { abbr } = await ctx.params;
  const seasonRaw = req.nextUrl.searchParams.get("season");
  const season = seasonRaw ? Number.parseInt(seasonRaw, 10) : undefined;
  const profile = await getTeamProfile(abbr, Number.isFinite(season as number) ? season : undefined);
  if (!profile) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  const extras = await getTeamProfileExtras(profile.team.id, profile.seasonYear);
  return jsonWithRateLimit(auth, {
    data: filterTeamPowerRankingsData(buildTeamPowerRankingsData(profile, extras), source.source),
  });
}

export const GET = withApiErrorHandling(handleGET);
