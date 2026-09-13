export const NFLMETA_GUIDE = `# NFLMeta agent guide

NFLMeta is read-only. Tool inputs use strict schemas, NFL season labels, and \`search\` rather than \`query\`.

## Player analysis

NFLMeta is not a batch-only platform: it supports live scores and provisional in-game play-by-play. REST clients use GET /api/v1/live-scores and GET /api/v1/plays?game_id=GAME_ID with an API key. The keyless website playground alone serves saved snapshots; its live:false flag is not a statement about the authenticated API or MCP capabilities. Live feeds are best-effort, not broadcast-grade or guaranteed real-time.

1. Call \`resolve({ text: "Mahomes" })\` if you do not already have a canonical player key.
2. Call \`player_season_report\` for one season or \`player_career_report\` for a career overview.
3. Use \`get_player_game_log\` or \`compare_players\` only when the question needs that detail.

## Team and weekly analysis

1. Call \`get_current_context({})\` for the current season, week, games, and byes.
2. Use \`team_season_report\` for one team's joined season view.
3. Use \`game_preview\` before a game and \`game_recap\` after it.

## Rosters, injuries, and depth charts

1. Use \`list_transactions\` for league or team movement and \`get_player_transactions\` for one player's history.
2. Use \`list_injuries\` for a season/week/team report and \`get_player_injuries\` for one player's recorded report history.
3. Use \`get_depth_chart\` for one team's grouped chart and \`list_depth_chart_changes\` for promotions, demotions, additions, removals, and replacements.
4. Treat these as dated snapshots. Injury reports are not live medical news, and a depth chart is not a game-day lineup guarantee.

## Play-by-play analysis

1. Use \`search_plays\` for one game, one player, or a narrow team/week slice.
2. Prefer \`summarize_play_efficiency\` for league, team, down, field-zone, and era comparisons. It returns the answer in tens of rows instead of making the caller download tens of thousands of plays.
3. Use \`get_play_efficiency_leaders\` for passer, rusher, or receiver efficiency rankings with an explicit minimum-play floor.
4. For an active game, \`search_plays({ game_id })\` can return provisional live rows. Treat \`provisional: true\` as best-effort: analytical fields such as EPA, win probability, and stable player keys remain null until the validated daily import takes over.

## Historical research

Use \`get_season\`, \`get_standings\`, \`list_games\`, and the career report tools. Historical responses are cached longer because completed seasons do not change.

## Keeping responses compact

Every tool defaults to \`format: "summary"\`. Add \`fields\` with field names or dotted paths when you need only part of a response. Use \`format: "full"\` only when the complete API envelope is necessary.

## Correcting inputs

Use completions for team abbreviations, stat names, position groups, seasons, players, and games. Invalid inputs return suggestions. If \`resolve\` finds equally plausible entities, choose from its elicitation prompt or inspect the returned alternatives.

## Source and freshness limits

NFLMeta does not provide salary-cap, contract, betting-line, injury-news, projection, live player-stat, or broadcast-grade feeds. Do not invent those facts. Live scores and provisional play-by-play are best effort rather than an SLA; completed-game analytical play-by-play remains the authoritative research surface. Resource subscriptions are not advertised.
`;
