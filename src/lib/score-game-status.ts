type ScoreStatus = {
  phase: string;
  completed: boolean;
  period: number | null;
  clock: string | null;
  statusDetail: string;
};

export function scoreGameStatus(game: ScoreStatus): string {
  if (game.phase !== 'in' || game.completed) return game.statusDetail;
  const detail = game.statusDetail.trim();
  if (/half|end\b|delay|suspend|postpon|cancel|final/i.test(detail)) return detail;
  const periods = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
  const period = game.period;
  const label = period && period > 0
    ? (period <= 4 ? periods[period - 1] : period === 5 ? 'Overtime' : `${period - 4}OT`)
    : detail.replace(/^\s*\d{1,2}:\d{2}\s*[-·–—]?\s*/, '')
      .replace(/\b([1-4](?:st|nd|rd|th))\b(?!\s+Quarter)/i, '$1 Quarter');
  const clock = game.clock?.trim() || detail.match(/^\s*(\d{1,2}:\d{2})\b/)?.[1];
  return [clock, label].filter(Boolean).join(' · ') || detail;
}
