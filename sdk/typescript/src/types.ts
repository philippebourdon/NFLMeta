export type QueryPrimitive = string | number | boolean | Date | null | undefined;
export type QueryValue = QueryPrimitive | QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;

export type UnknownRecord = Record<string, unknown>;

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: string;
  policy?: string;
}

export interface NFLMetaEnvelope<TData, TMeta = unknown> {
  data: TData;
  meta?: TMeta;
  status: number;
  rateLimit: RateLimitInfo;
  headers: Headers;
}

export interface FieldValue<TValue = unknown> {
  field: string;
  value: TValue;
}

export interface ListMeta {
  total?: number | null;
  limit?: number;
  offset?: number;
  returned?: number;
  has_more?: boolean;
  [key: string]: unknown;
}

export interface PaginationOptions {
  count?: boolean;
  limit?: number;
  offset?: number;
}

export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export interface TeamCapSpace { team_abbr: string; available_cap_space: number }
export interface CapSpaceMeta extends ListMeta {
  season: number; currency: 'USD'; metric: 'cap_space'; observed_at: string;
  stale: boolean; refresh_schedule: string;
}
export interface GameInactives {
  game_id: number;
  teams: { team_abbr: string; status: 'confirmed' | 'not_available'; published_at: string | null;
    players: { name: string; position: string; note: string | null }[] }[];
}
export interface CurrentReserve {
  player_key: string; display_name: string; position: string | null; team_abbr: string;
  roster_status: string; label: string; confirmation: 'confirmed' | 'reported_pending'; updated_at: string | null;
}
export interface InjuryMeta extends ListMeta { current_reserves: CurrentReserve[] }
export interface PracticeDay extends UnknownRecord { date: string; status: 'DNP' | 'LP' | 'FP'; historical_backfill?: boolean; practiced?: boolean | null; report_reason?: string | null; non_injury_related?: boolean; first_observed_at?: string | null }
export interface InjuryRow extends UnknownRecord { report_status?: string | null; game_status?: string | null; practice_days?: PracticeDay[]; practice_only?: boolean; no_game_designation?: boolean }
export interface DepthChartRow extends UnknownRecord {
  player_key: string | null; source_player_key?: string | null; identity_status?: 'matched' | 'merged' | 'unmatched';
  player_name: string; team_abbr: string | null; position_group: string; position_abbr: string;
  position_slot: number | null; depth_rank: number; captured_at: string;
}
export interface DefenseSpecialTeamsEvent { type: string; unit: 'defense' | 'special_teams' | 'unknown'; team_abbr: string | null; points: number | null; evidence: 'source_fields' | 'description' }
export interface DefenseSpecialTeamsPlay extends UnknownRecord {
  game_id: number; play_number: number; kick_distance: number | null; field_goal_result: string | null;
  extra_point_result: string | null; kicker_player_key: string | null; provisional: boolean; events: DefenseSpecialTeamsEvent[];
}

export interface NFLMetaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: HeadersInit;
}

export interface SeasonListItem {
  id: number;
  year: number;
  gameCount?: number;
  [key: string]: unknown;
}

export interface TeamListItem {
  id: number;
  abbr: string;
  city?: string | null;
  nickname?: string | null;
  fullName?: string | null;
  conference?: string | null;
  division?: string | null;
  gameCount?: number;
  [key: string]: unknown;
}

export interface GameListItem {
  id: number;
  isPlayoff?: boolean | null;
  seasonYear?: number | null;
  week?: number | null;
  round?: string | null;
  gameDate?: string | null;
  kickoffAt?: string | null;
  awayAbbr?: string | null;
  awayName?: string | null;
  homeAbbr?: string | null;
  homeName?: string | null;
  awayScore?: number | null;
  homeScore?: number | null;
  broadcastNetwork?: string | null;
  stadium?: string | null;
  [key: string]: unknown;
}

export interface PlayerListItem {
  player_key: string;
  display_name?: string | null;
  latest_team_abbr?: string | null;
  position?: string | null;
  position_group?: string | null;
  rookie_season?: number | null;
  last_season?: number | null;
  headshot_url?: string | null;
  [key: string]: unknown;
}

export interface PlayerIdentity {
  player_key: string;
  display_name?: string | null;
  football_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_group?: string | null;
  position?: string | null;
  latest_team_abbr?: string | null;
  jersey_number?: string | null;
  rookie_season?: number | null;
  last_season?: number | null;
  status?: string | null;
  years_of_experience?: number | null;
  headshot_url?: string | null;
  [key: string]: unknown;
}

export interface PlayerBio {
  birth_date?: string | null;
  birth_place?: string | null;
  height_in?: number | null;
  weight_lb?: number | null;
  college_name?: string | null;
  college_conference?: string | null;
  draft_year?: number | null;
  draft_round?: number | null;
  draft_pick?: number | null;
  draft_team?: string | null;
  [key: string]: unknown;
}

export interface PlayerIds {
  /**
   * Only the player key is returned. Cross-reference identifiers issued by
   * outside systems are retained internally for a possible future tier but are
   * stripped from every response, so declaring them here described a payload
   * that no longer exists -- and published two supplier-identifying names in a
   * shipped type definition.
   */
  player_key: string;
  [key: string]: unknown;
}

/**
 * One play. Mirrors the `Play` schema in the OpenAPI contract: only the five
 * fields the API always sends are required, everything else depends on the play
 * type (a kickoff has no `down`, a run has no `air_yards`) and the index
 * signature keeps a newly added column from being a breaking change.
 */
export interface PlayListItem {
  game_id: number;
  play_number: number;
  season_year: number;
  season_type: string;
  /** True for in-game rows awaiting the validated analytical feed. */
  provisional: boolean;
  week?: number | null;
  drive_number?: number | null;
  drive_result?: string | null;
  quarter?: number | null;
  game_clock?: string | null;
  posteam_abbr?: string | null;
  defteam_abbr?: string | null;
  down?: number | null;
  yards_to_go?: number | null;
  yardline_100?: number | null;
  play_type?: string | null;
  description?: string | null;
  yards_gained?: number | null;
  success?: boolean | null;
  touchdown?: boolean | null;
  ep?: number | null;
  epa?: number | null;
  wp?: number | null;
  wpa?: number | null;
  cpoe?: number | null;
  passer_player_key?: string | null;
  rusher_player_key?: string | null;
  receiver_player_key?: string | null;
  kicker_player_key?: string | null;
  [key: string]: unknown;
}

/**
 * One aggregated group from /api/v1/plays/summary. `plays` counts everything
 * the filter matched; every rate below is computed over `scrimmage_plays`, and
 * `meta.rate_basis` on the response says so explicitly.
 */
export interface PlaySummaryRow {
  group_key: string;
  plays: number;
  scrimmage_plays: number;
  epa_total?: number | null;
  epa_per_play?: number | null;
  success_rate?: number | null;
  yards_per_play?: number | null;
  pass_rate?: number | null;
  explosive_rate?: number | null;
  first_down_rate?: number | null;
  touchdowns?: number | null;
  turnovers?: number | null;
  cpoe?: number | null;
  [key: string]: unknown;
}

/**
 * One row from /api/v1/plays/leaders. `plays` is the population the role was
 * measured over -- dropbacks, rush attempts, or targets -- not a box-score
 * attempt count, and `yards_gained` is a sum over those plays rather than an
 * official statistic. `meta.play_basis` names the population.
 */
export interface PlayLeaderRow {
  player_key: string;
  plays: number;
  player_name?: string | null;
  team?: string | null;
  teams?: string | null;
  yards_gained?: number | null;
  yards_gained_per_play?: number | null;
  epa_total?: number | null;
  epa_per_play?: number | null;
  success_rate?: number | null;
  touchdowns?: number | null;
  cpoe?: number | null;
  [key: string]: unknown;
}

export interface UsageSnapshot {
  api_key_id: number;
  billing_plan?: string | null;
  minute_request_count?: number;
  minute_limit?: number;
  minute_remaining?: number;
  minute_reset_at?: string | null;
  minute_policy?: string | null;
  quota_source?: string | null;
  request_count?: number;
  lifetime_request_count?: number;
  quota_limit?: number;
  quota_remaining?: number;
  quota_reset_at?: string | null;
  policy?: string | null;
  [key: string]: unknown;
}

export interface HealthSnapshot {
  status: string;
  db?: boolean;
  [key: string]: unknown;
}

export interface LiveScoreTeam {
  abbr: string;
  name: string;
  logo_url: string | null;
  score: number | null;
}

export interface LiveScoreGame {
  game_id: number;
  season_year: number;
  week: number | null;
  kickoff_at: string;
  away_team: LiveScoreTeam;
  home_team: LiveScoreTeam;
  phase: "pre" | "in" | "post";
  completed: boolean;
  period: number | null;
  clock: string | null;
  status_detail: string;
  observed_at: string | null;
  changed_at: string | null;
}

export interface LiveScoreMeta {
  available: boolean;
  stale: boolean;
  generated_at: string;
  last_success_at: string | null;
  last_change_at: string | null;
  recommended_poll_seconds: number;
  target_delay_seconds: 20;
  service_level: "best_effort";
}
