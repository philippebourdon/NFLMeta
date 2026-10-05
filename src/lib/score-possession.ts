import type { LiveScoreGame } from './live-score-store';

type PossessionGame = Pick<LiveScoreGame, "phase" | "completed" | "possessionAbbr" | "home" | "away">;

export function possessionTeam(game: PossessionGame, stale = false): string | null {
  if (stale || game.phase !== 'in' || game.completed) return null;
  const aliases: Record<string, string> = {WSH: 'WAS', JAC: 'JAX'};
  const normalize = (value: string) => aliases[value.toUpperCase()] || value.toUpperCase();
  const abbr = normalize(game.possessionAbbr || '');
  return [game.home.abbr, game.away.abbr].find(team => normalize(team) === abbr) || null;
}
