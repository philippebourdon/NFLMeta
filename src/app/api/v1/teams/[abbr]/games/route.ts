import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { findTeamByAbbr, listRecentGamesForTeam } from "@/lib/public-data";
import { withApiErrorHandling } from "@/lib/api-route-error";

function parseIntQuery(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function handleGET(req: NextRequest, ctx: { params: Promise<{ abbr: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { abbr } = await ctx.params;
  const team = await findTeamByAbbr(abbr);
  if (!team) {
    return jsonApiError(auth, 404, "not_found", "team not found");
  }

  const limit = parseIntQuery(req.nextUrl.searchParams.get("limit"), 5, 1, 100);
  const data = await listRecentGamesForTeam(team.id, limit);

  return jsonWithRateLimit(auth, {
    data,
    meta: {
      team: team.abbr,
      returned: data.length,
      limit,
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
