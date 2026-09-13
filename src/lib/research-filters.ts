import { LEADER_DEFAULT_MIN_PLAYS, LEADER_ROLES, LEADER_SORTS, SUMMARY_GROUPINGS } from "@/lib/plays-data";

export type ResearchParams = Record<string, string | string[] | undefined>;
export const RESEARCH_MODES = ["leaders", "situations", "trends"] as const;
export function parseResearchFilters(params: ResearchParams, latestSeason: number) {
  const text = (key: string, fallback = "") => {
    const value = params[key];
    if (Array.isArray(value)) throw new Error(`Use only one ${key} value.`);
    return value?.trim() || fallback;
  };
  function choice<T extends string>(key: string, values: readonly T[], fallback: T): T {
    const value = text(key, fallback);
    if (!values.includes(value as T)) throw new Error(`Invalid ${key}.`);
    return value as T;
  }
  function integer(key: string, fallback: number, min: number, max: number) {
    const raw = text(key, String(fallback));
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be a whole number between ${min} and ${max}.`);
    }
    return value;
  }
  const mode = choice("mode", RESEARCH_MODES, "leaders");
  const season = integer("season", latestSeason, 1999, latestSeason);
  const from = mode === "trends" ? integer("from", Math.max(1999, season - 9), 1999, season) : season;
  const role = choice("role", LEADER_ROLES, "passer");
  const team = text("team").toUpperCase();
  const opponent = text("opponent").toUpperCase();
  if ((team && !/^[A-Z]{2,3}$/.test(team)) || (opponent && !/^[A-Z]{2,3}$/.test(opponent))) throw new Error("Use a team abbreviation such as KC or PHI.");
  return {
    mode, season, from, role, team, opponent,
    seasonType: choice("season_type", ["REG", "POST", "ALL"] as const, "REG"),
    sort: choice("sort", LEADER_SORTS, "epa_per_play"),
    minPlays: integer("min_plays", LEADER_DEFAULT_MIN_PLAYS[role], 1, 10000),
    groupBy: mode === "trends" ? "season" as const : choice("group_by", SUMMARY_GROUPINGS.filter((x) => x !== "game"), "team"),
    down: integer("down", 0, 0, 4) || undefined,
    quarter: integer("quarter", 0, 0, 6) || undefined,
    redZone: choice("red_zone", ["false", "true"] as const, "false") === "true",
    playType: choice("play_type", ["", "pass", "run"] as const, "") || undefined,
  };
}
export type ResearchFilters = ReturnType<typeof parseResearchFilters>;

export function researchApiExample(f: ResearchFilters) {
  const args: Record<string, string | number | boolean> = { season_type: f.seasonType, limit: 100 };
  if (f.team) args.team = f.team;
  if (f.opponent) args.opponent = f.opponent;
  if (f.mode === "leaders") {
    Object.assign(args, { season: f.season, role: f.role, sort: f.sort, min_plays: f.minPlays, order: "desc" });
  } else {
    Object.assign(args, f.mode === "trends" ? { season_from: f.from, season_to: f.season } : { season: f.season });
    args.group_by = f.groupBy;
    if (f.down) args.down = f.down;
    if (f.quarter) args.quarter = f.quarter;
    if (f.redZone) args.red_zone = true;
    if (f.playType) args.play_type = f.playType;
  }
  return {
    path: `/api/v1/plays/${f.mode === "leaders" ? "leaders" : "summary"}?${new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]))}`,
    tool: f.mode === "leaders" ? "get_play_efficiency_leaders" : "summarize_play_efficiency",
    args,
  };
}
