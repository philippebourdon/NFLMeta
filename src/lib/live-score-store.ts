import { resolveTeamBrandLogoUrl } from "@/lib/asset-catalog";
import { query } from "@/lib/db";

export type LiveScoreGame = {
  possessionAbbr?: string | null;
  gameId: number;
  seasonYear: number;
  week: number | null;
  kickoffAt: string;
  home: { abbr: string; name: string; logoUrl: string | null; score: number | null };
  away: { abbr: string; name: string; logoUrl: string | null; score: number | null };
  phase: "pre" | "in" | "post";
  completed: boolean;
  period: number | null;
  clock: string | null;
  statusDetail: string;
  observedAt: string | null;
  changedAt: string | null;
};

export type LiveScoreSnapshot = {
  available: boolean;
  stale: boolean;
  generatedAt: string;
  lastSuccessAt: string | null;
  lastChangeAt: string | null;
  nextPollSeconds: number;
  playLastSuccessAt?: string | null;
  playConsecutiveFailures?: number;
  playEventCount?: number;
  playRowCount?: number;
  playLastErrorCode?: string | null;
  games: LiveScoreGame[];
};

export type GameLiveState = {
  homeScore: number | null;
  awayScore: number | null;
  phase: "pre" | "in" | "post";
  completed: boolean;
  period: number | null;
  clock: string | null;
  statusDetail: string;
  observedAt: string | null;
};

type ScoreRow = {
  possession_abbr: string | null;
  game_id: number;
  season_year: number;
  week: number | null;
  kickoff_at: Date | string;
  home_abbr: string;
  home_name: string;
  away_abbr: string;
  away_name: string;
  historical_home_score: number | null;
  historical_away_score: number | null;
  live_home_score: number | null;
  live_away_score: number | null;
  phase: "pre" | "in" | "post" | null;
  completed: boolean | null;
  period: number | null;
  game_clock: string | null;
  status_detail: string | null;
  observed_at: Date | string | null;
  changed_at: Date | string | null;
};

type FeedStatusRow = {
  last_success_at: Date | string | null;
  last_change_at: Date | string | null;
  next_poll_seconds: number;
  play_last_success_at: Date | string | null;
  play_consecutive_failures: number;
  play_event_count: number;
  play_row_count: number;
  play_last_error_code: string | null;
};

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function missingLiveScoreSchema(error: unknown): boolean {
  return typeof error === "object" && error != null && "code" in error && error.code === "42P01";
}

export async function getGameLiveState(gameId: number): Promise<GameLiveState | null> {
  try {
    const rows = await query<{
      home_score: number | null;
      away_score: number | null;
      phase: "pre" | "in" | "post";
      completed: boolean;
      period: number | null;
      game_clock: string | null;
      status_detail: string;
      observed_at: Date | string | null;
    }>(
      `SELECT home_score, away_score, phase, completed, period, game_clock,
              status_detail, observed_at
         FROM live_game_states
        WHERE game_id = $1`,
      [gameId],
    );
    const row = rows[0];
    return row ? {
      homeScore: row.home_score,
      awayScore: row.away_score,
      phase: row.phase,
      completed: row.completed,
      period: row.period,
      clock: row.game_clock,
      statusDetail: row.status_detail,
      observedAt: iso(row.observed_at),
    } : null;
  } catch (error) {
    if (!missingLiveScoreSchema(error)) throw error;
    return null;
  }
}

export async function getLiveScoreSnapshot(now = new Date()): Promise<LiveScoreSnapshot> {
  const generatedAt = now.toISOString();
  try {
    const [statusRows, rows] = await Promise.all([
      query<FeedStatusRow>(
        `SELECT last_success_at, last_change_at, next_poll_seconds,
                play_last_success_at, play_consecutive_failures,
                play_event_count, play_row_count, play_last_error_code
           FROM live_score_feed_status
          WHERE singleton = true`,
      ),
      query<ScoreRow>(
        `WITH active_season AS (
           SELECT MAX(s.year)::int AS year
             FROM games g
             JOIN seasons s ON s.id = g.season_id
            WHERE g.kickoff_at >= now() - interval '30 days'
         ), target_week AS (
           SELECT MIN(g.week)::int AS week
             FROM games g
             JOIN seasons s ON s.id = g.season_id
             JOIN active_season active ON active.year = s.year
            WHERE g.kickoff_at >= now() - interval '8 hours'
         )
         SELECT g.id AS game_id,
                s.year::int AS season_year,
                g.week,
                COALESCE(g.kickoff_at, g.game_date::timestamptz) AS kickoff_at,
                ht.nfl_abbr AS home_abbr,
                ht.full_name AS home_name,
                at.nfl_abbr AS away_abbr,
                at.full_name AS away_name,
                g.home_score AS historical_home_score,
                g.away_score AS historical_away_score,
                live.home_score AS live_home_score,
                live.away_score AS live_away_score,
                live.phase,
                live.completed,
                live.period,
                live.game_clock,
                live.status_detail,
                to_jsonb(live)->>'possession_abbr' AS possession_abbr,
                live.observed_at,
                live.changed_at
           FROM games g
           JOIN seasons s ON s.id = g.season_id
           JOIN teams ht ON ht.id = g.home_team_id
           JOIN teams at ON at.id = g.away_team_id
           JOIN active_season active ON active.year = s.year
           LEFT JOIN live_game_states live ON live.game_id = g.id
           CROSS JOIN target_week target
          WHERE g.week = target.week OR live.phase = 'in'
          ORDER BY COALESCE(g.kickoff_at, g.game_date::timestamptz), g.id`,
      ),
    ]);

    const status = statusRows[0];
    const lastSuccessAt = iso(status?.last_success_at || null);
    const nextPollSeconds = status?.next_poll_seconds || 900;
    const anyLive = rows.some((row) => row.phase === "in");
    const staleAfterMs = anyLive ? 35_000 : Math.max(90_000, nextPollSeconds * 2_000 + 30_000);
    const stale = !lastSuccessAt || now.getTime() - Date.parse(lastSuccessAt) > staleAfterMs;

    return {
      available: Boolean(lastSuccessAt),
      stale,
      generatedAt,
      lastSuccessAt,
      lastChangeAt: iso(status?.last_change_at || null),
      nextPollSeconds,
      playLastSuccessAt: iso(status?.play_last_success_at || null),
      playConsecutiveFailures: status?.play_consecutive_failures || 0,
      playEventCount: status?.play_event_count || 0,
      playRowCount: status?.play_row_count || 0,
      playLastErrorCode: status?.play_last_error_code || null,
      games: rows.map((row) => {
        const phase = row.phase || (row.historical_home_score != null && row.historical_away_score != null ? "post" : "pre");
        return {
          gameId: row.game_id,
          seasonYear: row.season_year,
          week: row.week,
          kickoffAt: iso(row.kickoff_at) || generatedAt,
          home: {
            abbr: row.home_abbr,
            name: row.home_name,
            logoUrl: resolveTeamBrandLogoUrl(row.home_abbr, row.home_name, row.season_year),
            score: row.live_home_score ?? row.historical_home_score,
          },
          away: {
            abbr: row.away_abbr,
            name: row.away_name,
            logoUrl: resolveTeamBrandLogoUrl(row.away_abbr, row.away_name, row.season_year),
            score: row.live_away_score ?? row.historical_away_score,
          },
          phase,
          completed: row.completed ?? phase === "post",
          period: row.period,
          clock: row.game_clock,
          statusDetail: row.status_detail || (phase === "post" ? "Final" : "Scheduled"),
          possessionAbbr: !stale && phase === 'in' && row.observed_at
            && now.getTime() - new Date(row.observed_at).getTime() <= 35_000
            ? row.possession_abbr : null,
          observedAt: iso(row.observed_at),
          changedAt: iso(row.changed_at),
        };
      }),
    };
  } catch (error) {
    if (!missingLiveScoreSchema(error)) throw error;
    return {
      available: false,
      stale: true,
      generatedAt,
      lastSuccessAt: null,
      lastChangeAt: null,
      nextPollSeconds: 900,
      playLastSuccessAt: null,
      playConsecutiveFailures: 0,
      playEventCount: 0,
      playRowCount: 0,
      playLastErrorCode: null,
      games: [],
    };
  }
}
