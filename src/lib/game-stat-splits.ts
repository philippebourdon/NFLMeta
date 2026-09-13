export const GAME_STAT_SPLITS = ["week", "team", "opponent", "home_away", "result", "position", "season_type"] as const;
export type GameStatSplit = (typeof GAME_STAT_SPLITS)[number];

const SPLIT_COLUMN: Record<GameStatSplit, string> = {
  week: "week", team: "team_abbr", opponent: "opponent_abbr", home_away: "home_away",
  result: "result", position: "position", season_type: "season_type",
};

/** Input is the complete ranked population, not a paginated leaderboard. */
export function aggregateGameStatSplits<T extends Record<string, unknown>>(
  rows: T[], splitBy: GameStatSplit, leaderLimit = 10,
) {
  const groups = new Map<string, { count: number; total: number; leaders: T[] }>();
  const cap = Math.max(0, Math.min(10, Math.trunc(leaderLimit)));
  for (const row of rows) {
    // Unknown is not zero. Explicit zeroes are valid observations.
    if (row.stat_value == null || row.stat_value === "") continue;
    const value = Number(row.stat_value);
    if (!Number.isFinite(value)) continue;
    const key = splitBy === "week"
      ? row.season_type === "POST" ? `POST:${String(row.round || "UNK")}` : `REG:${String(row.week ?? "0")}`
      : String(row[SPLIT_COLUMN[splitBy]] ?? "unknown");
    const group = groups.get(key) ?? { count: 0, total: 0, leaders: [] };
    group.count += 1;
    group.total += value;
    if (group.leaders.length < cap) group.leaders.push(row);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })).map(([key, group]) => ({
    split_key: key, split_by: splitBy, count: group.count, stat_total: group.total,
    stat_avg: group.total / group.count, leaders: group.leaders,
  }));
}
