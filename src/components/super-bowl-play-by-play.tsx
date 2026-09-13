import type { SupplementalPlayByPlayRow } from "@/lib/super-bowl-supplemental-schema";

import styles from "./game-play-by-play.module.css";

type TeamSummary = {
  abbr: string;
  name: string;
};

type PresentedPlay = SupplementalPlayByPlayRow & {
  order: number;
  scoring: boolean;
};

function groupByQuarter(plays: PresentedPlay[]): Array<[number | null, PresentedPlay[]]> {
  const groups = new Map<number | null, PresentedPlay[]>();
  for (const play of plays) {
    const quarter = play.quarter ?? null;
    const group = groups.get(quarter) || [];
    group.push(play);
    groups.set(quarter, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));
}

function quarterName(quarter: number | null): string {
  if (quarter == null) return "Game notes";
  if (quarter === 1) return "First quarter";
  if (quarter === 2) return "Second quarter";
  if (quarter === 3) return "Third quarter";
  if (quarter === 4) return "Fourth quarter";
  return `Overtime ${quarter - 4}`;
}

function quarterShort(quarter: number | null): string {
  if (quarter == null) return "Note";
  return quarter <= 4 ? `Q${quarter}` : `OT${quarter - 4}`;
}

function presentPlays(plays: SupplementalPlayByPlayRow[]): PresentedPlay[] {
  let awayScore = 0;
  let homeScore = 0;

  return plays.map((play, index) => {
    const nextAway = play.awayScore ?? awayScore;
    const nextHome = play.homeScore ?? homeScore;
    const scoring = nextAway !== awayScore || nextHome !== homeScore;
    awayScore = nextAway;
    homeScore = nextHome;
    return { ...play, order: index + 1, scoring };
  });
}

export default function SuperBowlPlayByPlay({
  plays,
  away,
  home,
}: {
  plays: SupplementalPlayByPlayRow[];
  away: TeamSummary;
  home: TeamSummary;
}) {
  if (!plays.length) {
    return (
      <section className={styles.unavailable} aria-labelledby="super-bowl-play-by-play-heading">
        <div className={styles.icon} aria-hidden="true">PBP</div>
        <div>
          <p className={styles.eyebrow}>Super Bowl timeline</p>
          <h2 id="super-bowl-play-by-play-heading">Play-by-play</h2>
          <p>Play-by-play is not available for this Super Bowl.</p>
        </div>
      </section>
    );
  }

  const presented = presentPlays(plays);
  const quarters = groupByQuarter(presented);
  const playedQuarters = new Set(presented.map((play) => play.quarter).filter((quarter) => quarter != null));
  const scoringCount = presented.filter((play) => play.scoring).length;
  const overtime = presented.some((play) => (play.quarter ?? 0) > 4);

  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span className={styles.icon} aria-hidden="true">PBP</span>
        <span className={styles.summaryCopy}>
          <span className={styles.eyebrow}>Every snap. Every Super Bowl moment.</span>
          <strong>Explore the complete Super Bowl play-by-play</strong>
          <span>{plays.length.toLocaleString()} timeline events from kickoff through the final whistle</span>
        </span>
        <span className={styles.openAction}>
          <span className={styles.openLabel}>Open timeline</span>
          <span className={styles.closeLabel}>Close timeline</span>
          <span className={styles.chevron} aria-hidden="true">⌄</span>
        </span>
      </summary>

      <div className={styles.content}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>The championship, play by play</p>
            <h2>Full Super Bowl timeline</h2>
            <p>{away.name} against {home.name}, organized quarter by quarter.</p>
          </div>
          <div className={styles.scoreKey} aria-label="Teams">
            <span><i className={styles.awayDot} />{away.abbr}</span>
            <span><i className={styles.homeDot} />{home.abbr}</span>
          </div>
        </div>

        <div className={styles.metrics} aria-label="Super Bowl play-by-play summary">
          <div><strong>{plays.length.toLocaleString()}</strong><span>Events</span></div>
          <div><strong>{playedQuarters.size.toLocaleString()}</strong><span>Periods</span></div>
          <div><strong>{scoringCount.toLocaleString()}</strong><span>Score updates</span></div>
          <div><strong>{overtime ? "Yes" : "No"}</strong><span>Overtime</span></div>
        </div>

        <div className={styles.quarters}>
          {quarters.map(([quarter, quarterPlays]) => (
            <section className={styles.quarter} key={quarter ?? "notes"} aria-labelledby={`super-bowl-quarter-${quarter ?? "notes"}`}>
              <div className={styles.quarterHead}>
                <span>{quarterShort(quarter)}</span>
                <div>
                  <h3 id={`super-bowl-quarter-${quarter ?? "notes"}`}>{quarterName(quarter)}</h3>
                  <p>{quarterPlays.length.toLocaleString()} events</p>
                </div>
              </div>

              <ol className={styles.timeline}>
                {quarterPlays.map((play) => {
                  const team = play.teamSide === "away" ? away : play.teamSide === "home" ? home : null;
                  const hasScore = play.awayScore != null && play.homeScore != null;
                  return (
                    <li className={`${styles.play} ${play.scoring ? styles.scoring : ""}`} key={play.order}>
                      <div className={styles.timeRail}>
                        <strong>{play.time || "No clock"}</strong>
                        <span>{quarterShort(play.quarter ?? null)}</span>
                      </div>
                      <div className={styles.playBody}>
                        <div className={styles.playMeta}>
                          {team ? <strong>{team.abbr}</strong> : null}
                          {play.downDistance ? <span>{play.downDistance}</span> : null}
                          {play.fieldPosition ? <span>{play.fieldPosition}</span> : null}
                        </div>
                        <p>{play.detail}</p>
                        {play.scoring ? <div className={styles.playFooter}><strong>Score update</strong></div> : null}
                      </div>
                      {hasScore ? (
                        <div className={styles.playScore} aria-label={`Score after play: ${away.abbr} ${play.awayScore}, ${home.abbr} ${play.homeScore}`}>
                          <span>{away.abbr} <strong>{play.awayScore}</strong></span>
                          <span>{home.abbr} <strong>{play.homeScore}</strong></span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}
