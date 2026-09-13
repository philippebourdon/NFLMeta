import type { LiveScoreGame, LiveScoreSnapshot } from "@/lib/live-score-store";

export type LiveScoreApiTeam = {
  abbr: string;
  name: string;
  logo_url: string | null;
  score: number | null;
};

export type LiveScoreApiGame = {
  game_id: number;
  season_year: number;
  week: number | null;
  kickoff_at: string;
  away_team: LiveScoreApiTeam;
  home_team: LiveScoreApiTeam;
  phase: "pre" | "in" | "post";
  completed: boolean;
  period: number | null;
  clock: string | null;
  status_detail: string;
  observed_at: string | null;
  changed_at: string | null;
};

export type LiveScoreApiMeta = {
  available: boolean;
  stale: boolean;
  generated_at: string;
  last_success_at: string | null;
  last_change_at: string | null;
  recommended_poll_seconds: number;
  target_delay_seconds: 20;
  service_level: "best_effort";
};

function toTeam(team: LiveScoreGame["home"]): LiveScoreApiTeam {
  return {
    abbr: team.abbr,
    name: team.name,
    logo_url: team.logoUrl,
    score: team.score,
  };
}

export function toLiveScoreApiResponse(snapshot: LiveScoreSnapshot): {
  data: LiveScoreApiGame[];
  meta: LiveScoreApiMeta;
} {
  return {
    data: snapshot.games.map((game) => ({
      game_id: game.gameId,
      season_year: game.seasonYear,
      week: game.week,
      kickoff_at: game.kickoffAt,
      away_team: toTeam(game.away),
      home_team: toTeam(game.home),
      phase: game.phase,
      completed: game.completed,
      period: game.period,
      clock: game.clock,
      status_detail: game.statusDetail,
      observed_at: game.observedAt,
      changed_at: game.changedAt,
    })),
    meta: {
      available: snapshot.available,
      stale: snapshot.stale,
      generated_at: snapshot.generatedAt,
      last_success_at: snapshot.lastSuccessAt,
      last_change_at: snapshot.lastChangeAt,
      recommended_poll_seconds: Math.max(10, snapshot.nextPollSeconds),
      target_delay_seconds: 20,
      service_level: "best_effort",
    },
  };
}
