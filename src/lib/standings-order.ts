type RecordRow = {wins:number;losses:number;ties:number};
// Neutral placement for an unplayed team, NOT a reported winning percentage.
// This places 0-0 below winning records and above losing records in opening week.
export function compareStandingRecords(a:RecordRow,b:RecordRow){
  const pct=(r:RecordRow)=>{const n=r.wins+r.losses+r.ties;return n?(r.wins+r.ties*.5)/n:.5;};
  return pct(b)-pct(a)||b.wins-a.wins||a.losses-b.losses||b.ties-a.ties;
}
export function standingsPosition<T extends RecordRow>(rows:T[],team:T){
  return {rank:1+rows.filter(r=>compareStandingRecords(r,team)<0).length,tied:rows.filter(r=>compareStandingRecords(r,team)===0).length>1};
}
export function missingScheduledTeams<T extends {team_id:number}>(records:T[],scheduled:T[]):T[]{
  const known=new Set(records.map(r=>r.team_id));
  return scheduled.filter(r=>!known.has(r.team_id));
}
