/** Keep pregame pages listening so the server can move them into live mode. */
export function gameRefreshIntervalMs(
  phase: "pre" | "in" | "post" | null | undefined,
  gameDate: string | null,
  hasFinalScore: boolean,
  now = Date.now(),
  awaitingFinalTimeline = false,
): number | null {
  if (phase === "in") return 5_000;
  if (phase === "post") {
    const kickoff = gameDate ? Date.parse(gameDate) : NaN;
    return awaitingFinalTimeline && Number.isFinite(kickoff) && now - kickoff <= 8 * 60 * 60_000 ? 10_000 : null;
  }
  if (phase === "pre") return 30_000;
  // A scheduled game may not have a live-feed row yet. Keep checking until
  // it does, without polling historical games that lack scores.
  const scheduledAt = gameDate ? Date.parse(gameDate) : NaN;
  return !hasFinalScore && scheduledAt >= now - 24 * 60 * 60_000 ? 30_000 : null;
}
