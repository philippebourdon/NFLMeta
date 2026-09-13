import { NextRequest } from 'next/server';
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from '@/lib/api-key';
import { withApiErrorHandling } from '@/lib/api-route-error';
import { currentSeasonYear } from '@/lib/current-season';
import { CAP_TEAM_ABBRS } from '@/lib/cap-space-snapshot';
import { listTeamCapSpace } from '@/lib/team-cap-space';

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);
  const params = req.nextUrl.searchParams;
  const rawSeason = params.get('season') ?? String(currentSeasonYear());
  const team = params.has('team_abbr') ? params.get('team_abbr')!.trim().toUpperCase() : undefined;
  if (!/^\d{4}$/.test(rawSeason) || Number(rawSeason) < 2026 || Number(rawSeason) > currentSeasonYear())
    return jsonApiError(auth, 400, 'invalid_request', 'season must be between 2026 and the current NFL season');
  if (team !== undefined && !CAP_TEAM_ABBRS.includes(team))
    return jsonApiError(auth, 400, 'invalid_request', 'team_abbr must be a canonical NFL abbreviation, such as NE or KC');
  const result = await listTeamCapSpace(Number(rawSeason), team);
  if (!result) return jsonApiError(auth, 503, 'maintenance', 'No complete cap-space snapshot is available for this season');
  return jsonWithRateLimit(auth, result);
});
