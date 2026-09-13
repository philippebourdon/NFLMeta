import { NextRequest } from 'next/server';
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from '@/lib/api-key';
import { getGameInactives } from '@/lib/game-inactives';
import { withApiErrorHandling } from '@/lib/api-route-error';

export const GET = withApiErrorHandling(async (req: NextRequest, context: {params: Promise<{id:string}>}) => {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);
  const {id} = await context.params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return jsonApiError(auth,400,'invalid_request','id must be a positive game ID');
  const result = await getGameInactives(Number(id));
  if (!result) return jsonApiError(auth,404,'not_found','Game not found');
  return jsonWithRateLimit(auth,{data:result,meta:{game_id:Number(id),returned:result.teams.reduce((count,team)=>count+team.players.length,0)}});
});
