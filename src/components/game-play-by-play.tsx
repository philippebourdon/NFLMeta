import { Fragment } from "react";
import {
  formatDownAndDistance,
  formatFieldPosition,
  isScoringPlay,
  isTurnoverPlay,
  quarterLabel,
  scoreAfterPlay,
  shortQuarterLabel,
} from "@/lib/game-play-presentation";
import type { GameTimelinePlay } from "@/lib/plays-data";

import styles from "./game-play-by-play.module.css";

type TeamSummary = {
  abbr: string;
  name: string;
};

function groupByQuarter(plays: GameTimelinePlay[]): Array<[number | null, GameTimelinePlay[]]> {
  const groups = new Map<number | null, GameTimelinePlay[]>();
  for (const play of plays) {
    const group = groups.get(play.quarter) || [];
    group.push(play);
    groups.set(play.quarter, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a ?? -1) - (b ?? -1));
}

function readablePlayType(playType: string | null): string {
  if (!playType) return "Game note";
  return playType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function GamePlayByPlay({
  plays,
  away,
  home,
}: {
  plays: GameTimelinePlay[];
  away: TeamSummary;
  home: TeamSummary;
}) {
  const quarters = groupByQuarter(plays);
  const driveCount = new Set(plays.map((play) => play.drive_number).filter((drive) => drive != null)).size;
  const scoringCount = plays.filter(isScoringPlay).length;
  const turnoverCount = plays.filter(isTurnoverPlay).length;
  const live = plays.some((play) => play.is_live);

  if (!plays.length) {
    return (
      <section className={styles.unavailable} aria-labelledby="play-by-play-heading">
        <div className={styles.icon} aria-hidden="true">PBP</div>
        <div>
          <p className={styles.eyebrow}>Game timeline</p>
          <h2 id="play-by-play-heading">Play-by-play</h2>
          <p>Play-by-play is not available for this game.</p>
        </div>
      </section>
    );
  }

  return (
    <details className={styles.details} open={live || undefined}>
      <summary className={styles.summary}>
        <span className={styles.icon} aria-hidden="true">PBP</span>
        <span className={styles.summaryCopy}>
          <span className={styles.eyebrow}>{live ? "Updating during the game" : "Every snap. Every swing."}</span>
          <strong>{live ? "Follow live play-by-play" : "Explore the complete play-by-play"}</strong>
          <span>{plays.length.toLocaleString()} {live ? "live " : ""}timeline events across {driveCount.toLocaleString()} drives</span>
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
            <p className={styles.eyebrow}>The game, possession by possession</p>
            <h2>Full game timeline</h2>
            <p>{live
              ? `${away.name} at ${home.name}, updating automatically on a best-effort basis.`
              : `${away.name} at ${home.name}, reconstructed from the opening kick through the final whistle.`}</p>
          </div>
          <div className={styles.scoreKey} aria-label="Teams">
            <span><i className={styles.awayDot} />{away.abbr}</span>
            <span><i className={styles.homeDot} />{home.abbr}</span>
          </div>
        </div>

        <div className={styles.metrics} aria-label="Play-by-play summary">
          <div><strong>{plays.length.toLocaleString()}</strong><span>Events</span></div>
          <div><strong>{driveCount.toLocaleString()}</strong><span>Drives</span></div>
          <div><strong>{scoringCount.toLocaleString()}</strong><span>Scoring plays</span></div>
          <div><strong>{turnoverCount.toLocaleString()}</strong><span>Turnovers</span></div>
        </div>

        <div className={styles.quarters}>
          {quarters.map(([quarter, quarterPlays]) => (
            <section className={styles.quarter} key={quarter ?? "notes"} aria-labelledby={`quarter-${quarter ?? "notes"}`}>
              <div className={styles.quarterHead}>
                <span>{shortQuarterLabel(quarter)}</span>
                <div>
                  <h3 id={`quarter-${quarter ?? "notes"}`}>{quarterLabel(quarter)}</h3>
                  <p>{quarterPlays.length.toLocaleString()} events</p>
                </div>
              </div>

              <ol className={styles.timeline}>
                {quarterPlays.map((play, index) => {
                  const previous = index > 0 ? quarterPlays[index - 1] : null;
                  const startsDrive = play.drive_number != null && play.drive_number !== previous?.drive_number;
                  const scoring = isScoringPlay(play);
                  const turnover = isTurnoverPlay(play);
                  const score = scoreAfterPlay(play);
                  const downDistance = formatDownAndDistance(play);
                  const fieldPosition = formatFieldPosition(play);

                  return (
                    <Fragment key={play.play_number}>
                      {startsDrive ? (
                        <li className={styles.driveMarker}>
                          <span>Drive {play.drive_number}</span>
                          {play.posteam_abbr ? <strong>{play.posteam_abbr} possession</strong> : null}
                          {play.drive_result ? <em>{play.drive_result}</em> : null}
                        </li>
                      ) : null}
                      <li className={`${styles.play} ${scoring ? styles.scoring : ""} ${turnover ? styles.turnover : ""}`}>
                        <div className={styles.timeRail}>
                          <strong>{play.game_clock || "No clock"}</strong>
                          <span>{shortQuarterLabel(play.quarter)}</span>
                        </div>
                        <div className={styles.playBody}>
                          <div className={styles.playMeta}>
                            {play.posteam_abbr ? <strong>{play.posteam_abbr}</strong> : null}
                            <span>{readablePlayType(play.play_type)}</span>
                            {downDistance ? <span>{downDistance}</span> : null}
                            {fieldPosition ? <span>{fieldPosition}</span> : null}
                            {play.penalty ? <span className={styles.penaltyFlag}>Flag</span> : null}
                          </div>
                          <p>{play.description || "Administrative game marker"}</p>
                          <div className={styles.playFooter}>
                            {play.yards_gained != null ? (
                              <span className={play.yards_gained > 0 ? styles.positiveYards : undefined}>
                                {play.yards_gained > 0 ? "+" : ""}{play.yards_gained} yards
                              </span>
                            ) : null}
                            {play.first_down ? <span>First down</span> : null}
                            {scoring ? <strong>Scoring play</strong> : null}
                            {turnover ? <strong>Turnover</strong> : null}
                          </div>
                        </div>
                        {score ? (
                          <div className={styles.playScore} aria-label={`Score after play: ${away.abbr} ${score.away}, ${home.abbr} ${score.home}`}>
                            <span>{away.abbr} <strong>{score.away}</strong></span>
                            <span>{home.abbr} <strong>{score.home}</strong></span>
                          </div>
                        ) : null}
                      </li>
                    </Fragment>
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
