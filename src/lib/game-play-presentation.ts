import type { GameTimelinePlay } from "@/lib/plays-data";

export function groupPlaysChronologically(plays: GameTimelinePlay[]): Array<[number | null, GameTimelinePlay[]]> {
  const groups = new Map<number | null, GameTimelinePlay[]>();
  for (const play of plays) {
    const group = groups.get(play.quarter) || [];
    group.push(play);
    groups.set(play.quarter, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY))
    .map(([quarter, quarterPlays]) => [
      quarter,
      quarterPlays.sort((a, b) => a.play_number - b.play_number),
    ]);
}

export function quarterLabel(quarter: number | null): string {
  if (quarter == null) return "Game notes";
  if (quarter <= 4) return `Quarter ${quarter}`;
  return quarter === 5 ? "Overtime" : `Overtime ${quarter - 4}`;
}

export function shortQuarterLabel(quarter: number | null): string {
  if (quarter == null) return "—";
  if (quarter <= 4) return `Q${quarter}`;
  return quarter === 5 ? "OT" : `${quarter - 4}OT`;
}

export function formatDownAndDistance(play: Pick<GameTimelinePlay, "down" | "yards_to_go" | "goal_to_go">): string | null {
  if (play.down == null) return null;
  const ordinal = play.down === 1 ? "1st" : play.down === 2 ? "2nd" : play.down === 3 ? "3rd" : `${play.down}th`;
  if (play.goal_to_go) return `${ordinal} & Goal`;
  return play.yards_to_go == null ? ordinal : `${ordinal} & ${play.yards_to_go}`;
}

export function formatFieldPosition(
  play: Pick<GameTimelinePlay, "yardline_100" | "posteam_abbr" | "defteam_abbr">,
): string | null {
  const yardline = play.yardline_100;
  if (yardline == null) return null;
  if (yardline === 50) return "50-yard line";
  if (yardline <= 0) return "Goal line";
  if (yardline > 50) {
    const ownYardline = 100 - yardline;
    return play.posteam_abbr ? `${play.posteam_abbr} ${ownYardline}` : `Own ${ownYardline}`;
  }
  return play.defteam_abbr ? `${play.defteam_abbr} ${yardline}` : `Opponent ${yardline}`;
}

export function scoreAfterPlay(
  play: Pick<GameTimelinePlay, "posteam_is_home" | "posteam_score" | "defteam_score">,
): { away: number; home: number } | null {
  if (play.posteam_is_home == null || play.posteam_score == null || play.defteam_score == null) return null;
  return play.posteam_is_home
    ? { away: play.defteam_score, home: play.posteam_score }
    : { away: play.posteam_score, home: play.defteam_score };
}

export function isScoringPlay(
  play: Pick<
    GameTimelinePlay,
    "touchdown" | "field_goal_result" | "extra_point_result" | "two_point_conv_result" | "description"
  >,
): boolean {
  return Boolean(
    play.touchdown
      || play.field_goal_result?.toLowerCase() === "made"
      || play.extra_point_result?.toLowerCase() === "good"
      || ["success", "successful", "good"].includes(play.two_point_conv_result?.toLowerCase() || "")
      || /\bsafety\b/i.test(play.description || ""),
  );
}

export function isTurnoverPlay(
  play: Pick<GameTimelinePlay, "interception" | "fumble_lost">,
): boolean {
  return Boolean(play.interception || play.fumble_lost);
}
