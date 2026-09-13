export const SERVER_NAME = "nflmeta";
export const SERVER_VERSION = "0.8.0";

export const CUSTOMER_TOOL_NAMES = [
  "resolve",
  "search_players",
  "get_player_season_stats",
  "player_season_report",
  "player_career_report",
  "compare_players",
  "get_player_game_log",
  "team_season_report",
  "get_roster",
  "get_team_cap_space",
  "get_game_inactives",
  "get_current_context",
  "list_games",
  "get_season",
  "get_standings",
  "game_preview",
  "game_recap",
  "search_plays",
  "summarize_play_efficiency",
  "get_play_efficiency_leaders",
  "get_playoff_picture",
  "get_player_leaders",
  "list_draft_picks",
  "list_top_100",
  "get_player_jersey_history",
  "list_transactions",
  "get_player_transactions",
  "list_injuries",
  "get_player_injuries",
  "get_depth_chart",
  "list_depth_chart_changes",
  "get_my_usage",
  "nflmeta_api_get",
] as const;

export const CUSTOMER_PROMPT_NAMES = [
  "research-player",
  "weekly-preview",
  "trade-evaluation",
  "draft-scouting",
  "fantasy-start-sit",
  "historical-comparison",
  "game-breakdown",
] as const;

export const CATALOG = {
  name: "NFLMeta MCP",
  description: "Read-only NFL research tools backed by the NFLMeta public API.",
  documentation: "https://nflmeta.org/api-docs",
  toolSelection: {
    discovery: ["resolve", "search_players", "search_teams", "search_coaches", "get_stats_catalog"],
    reports: ["get_player_season_stats", "player_season_report", "player_career_report", "team_season_report", "game_preview", "game_recap"],
    profiles: ["get_player", "get_team", "get_game", "get_playoff_game", "get_season"],
    currentAndHistorical: ["get_current_context", "list_games", "get_playoff_picture", "get_roster", "get_standings", "list_draft_picks", "list_top_100", "get_player_jersey_history", "list_transactions", "get_player_transactions", "list_injuries", "get_player_injuries", "get_depth_chart", "list_depth_chart_changes", "get_super_bowl"],
    analytics: ["compare_players", "get_player_game_log", "get_weekly_stats", "get_game_leaders", "get_player_leaders", "get_career_leaders"],
    playByPlay: ["search_plays", "summarize_play_efficiency", "get_play_efficiency_leaders"],
    reference: ["get_hall_of_fame", "get_pro_bowl", "search_officials", "get_venue", "get_team_branding", "get_broadcast_rights"],
    advanced: ["nflmeta_api_get"],
  },
  identifiers: {
    player_key: "Discover with search_players; accepts NFLMeta keys and supported external-id forms.",
    team_abbr: "Use canonical abbreviations returned by search_teams (for example PIT, KC, SF).",
    game_id: "Discover with list_games.",
    season_year: "Use the NFL season label, not necessarily the calendar year of a game date.",
  },
  resources: [
    "nflmeta://guide",
    "nflmeta://player/{player_key}",
    "nflmeta://team/{abbr}",
    "nflmeta://game/{id}",
    "nflmeta://season/{year}",
  ],
  prompts: [
    "research-player",
    "weekly-preview",
    "trade-evaluation",
    "draft-scouting",
    "fantasy-start-sit",
    "historical-comparison",
    "explain-stat",
    "game-breakdown",
  ],
  behavior: [
    "All tools are read-only.",
    "All input schemas are strict: unknown arguments fail instead of being ignored.",
    "The player/name filter is called search, not query.",
    "Every tool defaults to compact Markdown summary output; use format='full' for complete JSON.",
    "Use fields with field names or dotted paths to project only the data needed.",
    "List tools cap limit at 100 to keep model context bounded.",
    "Responses preserve NFLMeta data/meta envelopes and downstream rate-limit information; composite tools aggregate per-source quota metadata.",
    "Tools publish output schemas and return validated structuredContent alongside human-readable text.",
    "Prompt and resource-template completion is available for teams, stats, position groups, and season years.",
    "Play-by-play covers completed games and supports raw game/player slices, compact efficiency summaries, and player efficiency leaderboards.",
    "Transactions, injury reports, and depth charts are recorded data snapshots, not breaking-news or medical feeds; inspect response dates and data-status metadata.",
    "Live scores are best effort; MCP resources are not subscription feeds and resource subscriptions are intentionally not advertised.",
    "Successful GET responses use a bounded in-memory LRU cache with freshness based on data type; usage and errors are never cached.",
    "Use nflmeta_api_get only when a specialized tool does not expose a documented /api/v1 endpoint.",
  ],
} as const;

export function catalogForProfile(profile: "full" | "customer"): Record<string, unknown> {
  if (profile === "full") return CATALOG;
  const tools = new Set<string>(CUSTOMER_TOOL_NAMES);
  const prompts = new Set<string>(CUSTOMER_PROMPT_NAMES);
  return {
    ...CATALOG,
    description: "Paid, read-only NFL research tools backed by the NFLMeta public API.",
    toolSelection: Object.fromEntries(
      Object.entries(CATALOG.toolSelection)
        .map(([group, names]) => [group, names.filter((name) => tools.has(name))])
        .filter(([, names]) => names.length > 0),
    ),
    prompts: CATALOG.prompts.filter((name) => prompts.has(name)),
  };
}
