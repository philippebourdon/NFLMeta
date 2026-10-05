import { NextRequest } from "next/server";
import { apiAuthErrorResponse, authenticateApiKey, jsonApiError, jsonWithRateLimit } from "@/lib/api-key";
import { getPlayerHistoryByKey } from "@/lib/raw-api-data";
import { parseWeeklyRosterSelection,listWeeklyRosterEntries,WEEKLY_ROSTER_WARNING } from '@/lib/weekly-roster-data';
import { resolveCanonicalPlayerKey } from '@/lib/player-key-aliases';
import { withApiErrorHandling } from "@/lib/api-route-error";

async function handleGET(req: NextRequest, ctx: { params: Promise<{ player_key: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return apiAuthErrorResponse(auth);
  }

  const { player_key } = await ctx.params;
  let weekly;
  try { weekly=parseWeeklyRosterSelection(req.nextUrl.searchParams); }
  catch(error) { return jsonApiError(auth,400,'invalid_request',(error as Error).message); }
  if (weekly) {
    const key=await resolveCanonicalPlayerKey(decodeURIComponent(player_key));
    if (!key) return jsonApiError(auth,404,'not_found','player not found');
    const integer=(name:string,fallback:number,min:number,max:number)=> {
      const parsed=Number.parseInt(req.nextUrl.searchParams.get(name)??'',10);
      return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;
    };
    const limit=integer('limit',100,1,500),offset=integer('offset',0,0,1_000_000);
    const year=Number(req.nextUrl.searchParams.get('year')??req.nextUrl.searchParams.get('season'));
    const result=await listWeeklyRosterEntries({year,week:weekly.week,seasonType:weekly.seasonType,playerKey:key,limit,offset,withCount:req.nextUrl.searchParams.get('count')==='true'});
    return jsonWithRateLimit(auth,{data:result.rows,meta:{year,week:weekly.week,season_type:weekly.seasonType,
      total:result.total,returned:result.rows.length,limit,offset,has_more:result.hasMore,snapshot_kind:'weekly_history',
      pre_kickoff_verified:false,warnings:[WEEKLY_ROSTER_WARNING]}});
  }
  const data = await getPlayerHistoryByKey(decodeURIComponent(player_key));
  if (!data) {
    return jsonApiError(auth, 404, "not_found", "player not found");
  }

  return jsonWithRateLimit(auth, {
    data: data.roster_entries,
  });
}

export const GET = withApiErrorHandling(handleGET);
