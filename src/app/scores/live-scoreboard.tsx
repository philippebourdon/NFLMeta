"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UiImage } from "@/components/ui-image";
import type { LiveScoreGame, LiveScoreSnapshot } from "@/lib/live-score-store";
import styles from "./page.module.css";
import { scoreGameStatus } from '@/lib/score-game-status';
import { possessionTeam } from '@/lib/score-possession';

export type ScoreboardSnapshot = Omit<LiveScoreSnapshot, "games"> & {
  games: Array<Omit<LiveScoreGame, "injuries">>;
};

function pollDelay(snapshot: ScoreboardSnapshot): number {
  const now = Date.now();
  if (snapshot.games.some((game) => game.phase === "in")) return 5_000;
  if (snapshot.games.some((game) => game.phase === "pre" && Date.parse(game.kickoffAt) - now <= 30 * 60_000)) {
    return 5_000;
  }
  return Math.min(60_000, Math.max(15_000, snapshot.nextPollSeconds * 1_000));
}

function kickoff(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function lastUpdated(value: string | null): string {
  if (!value) return "Waiting for the first update";
  const date = new Date(value);
  return `Updated ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date)}`;
}

function TeamRow({ team, possessionLabel }: {
  team: LiveScoreGame["home"];
  possessionLabel?: string;
}) {
  return (
    <div className={styles.teamRow}>
      <div className={styles.teamIdentity}>
        {team.logoUrl ? (
          <Image
            src={team.logoUrl}
            alt=""
            width={48}
            height={48}
            sizes="42px"
            loading="eager"
            className={styles.teamLogo}
          />
        ) : (
          <span className={styles.logoFallback} aria-hidden="true">{team.abbr}</span>
        )}
        <div className={styles.teamCopy}>
          <strong className={styles.teamNameLine}>{team.abbr}
            {possessionLabel ? <UiImage src="/images/scores-football.png"
              alt={possessionLabel} title={possessionLabel}
              width={40} height={20} className={styles.possessionFootball} /> : null}
          </strong>
          <span>{team.name}</span>
        </div>
      </div>
      <span className={styles.score}>{team.score ?? "TBD"}</span>
    </div>
  );
}

function GameCard({ game, stale }: { game: Omit<LiveScoreGame, "injuries">; stale: boolean }) {
  const live = game.phase === "in";
  const possession = possessionTeam(game, stale);
  return (
    <article className={`${styles.gameCard} ${live ? styles.liveCard : ""}`}>
      <div className={styles.gameMeta}>
        <span className={live ? styles.liveBadge : styles.statusBadge}>
          {live ? "Live" : game.statusDetail}
        </span>
        <span>Week {game.week ?? "TBD"}</span>
      </div>
      <p className={styles.kickoff}>{kickoff(game.kickoffAt)}</p>
      <div className={styles.teams} aria-live={live ? "polite" : "off"}>
        <TeamRow team={game.away} possessionLabel={possession === game.away.abbr ? `${game.away.name} has possession` : undefined} />
        <TeamRow team={game.home} possessionLabel={possession === game.home.abbr ? `${game.home.name} has possession` : undefined} />
      </div>
      <div className={styles.gameFooter}>
        <span>{scoreGameStatus(game)}</span>
        <Link href={`/games/${game.gameId}`}>Game details</Link>
      </div>
    </article>
  );
}

export default function LiveScoreboard({ initial }: { initial: ScoreboardSnapshot }) {
  const router = useRouter();
  const snapshot = initial;
  const [expiredSnapshot, setExpiredSnapshot] = useState<ScoreboardSnapshot | null>(null);

  useEffect(() => {
    if (!snapshot.games.some(game => game.phase === 'in')) return;
    const lastSuccess = Date.parse(snapshot.lastSuccessAt || '');
    const remaining = Number.isFinite(lastSuccess) ? lastSuccess + 35_000 - Date.now() : 0;
    const timer = setTimeout(() => setExpiredSnapshot(snapshot), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (!cancelled) timer = setTimeout(refresh, document.hidden ? 15_000 : pollDelay(snapshot));
    }

    function refresh() {
      // Refresh the server-rendered /scores tree instead of exposing a stable,
      // unauthenticated JSON feed for the browser. A determined scraper can
      // still read public HTML, but there is no parallel free API contract to
      // bypass /api/v1/live-scores and its normal plan limits.
      router.refresh();
      schedule();
    }

    schedule();
    const onVisible = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, snapshot]);

  const groups = useMemo(() => ({
    live: snapshot.games.filter((game) => game.phase === "in"),
    upcoming: snapshot.games.filter((game) => game.phase === "pre"),
    final: snapshot.games.filter((game) => game.phase === "post"),
  }), [snapshot.games]);
  const delayed = snapshot.stale || expiredSnapshot === snapshot;

  return (
    <section className={styles.scoreboard}>
      <div className={styles.feedBar}>
        <div>
          <span className={`${styles.feedDot} ${delayed ? styles.feedDotDelayed : ""}`} aria-hidden="true" />
          <strong>{delayed ? "Updates delayed" : groups.live.length ? "Updating live" : "Score feed ready"}</strong>
        </div>
        <span>{lastUpdated(snapshot.lastSuccessAt)}</span>
      </div>

      {!snapshot.available && snapshot.games.length === 0 ? (
        <div className={styles.emptyState}>
          <h2>Score feed is starting</h2>
          <p>Scheduled games and live updates will appear here as soon as the feed checks in.</p>
        </div>
      ) : null}

      {(["live", "upcoming", "final"] as const).map((group) => groups[group].length ? (
        <div key={group} className={styles.group}>
          <h2>{group === "live" ? "Live now" : group === "upcoming" ? "Upcoming" : "Final"}</h2>
          <div className={styles.grid}>
            {groups[group].map((game) => <GameCard key={game.gameId} game={game} stale={delayed} />)}
          </div>
        </div>
      ) : null)}

      <p className={styles.disclaimer}>
        Live scores are provided free for convenience on a best-effort basis. Timing and accuracy are not guaranteed.{" "}
        Developers can use <Link href="/api-docs/core-endpoints"><code>GET /api/v1/live-scores</code></Link> with any active
        NFLMeta API key, including Free.
      </p>
    </section>
  );
}
