import { Fragment } from "react";
import { hasEndGameEvent } from "@/lib/final-timeline";
import {
  formatDownAndDistance,
  formatFieldPosition,
  groupPlaysChronologically,
  isScoringPlay,
  isTurnoverPlay,
  quarterLabel,
  scoreAfterPlay,
  shortQuarterLabel,
} from "@/lib/game-play-presentation";
import type { GameTimelinePlay } from "@/lib/plays-data";
import type { LiveGameInjury } from "@/lib/live-score-store";
import { gameInjuryNotices } from "@/lib/game-injury-presentation";

import styles from "./game-play-by-play.module.css";

type TeamSummary = {
  abbr: string;
  name: string;
};

function readablePlayType(playType: string | null): string {
  if (!playType) return "Game note";
  return playType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportedTime(value: string): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(time);
}

export default function GamePlayByPlay({
  plays,
  injuries = [],
  away,
  home,
  gameFinal = false,
  gameLive = false,
}: {
  plays: GameTimelinePlay[];
  injuries?: LiveGameInjury[];
  away: TeamSummary;
  home: TeamSummary;
  gameFinal?: boolean;
  gameLive?: boolean;
}) {
  const quarters = groupPlaysChronologically(plays);
  const injuryNotices = gameInjuryNotices(injuries, gameFinal);
  const numberedQuarters = plays.flatMap((play) => play.quarter == null ? [] : [play.quarter]);
  const currentQuarter = numberedQuarters.length ? Math.max(...numberedQuarters) : null;
  const driveCount = new Set(plays.map((play) => play.drive_number).filter((drive) => drive != null)).size;
  const scoringCount = plays.filter(isScoringPlay).length;
  const turnoverCount = plays.filter(isTurnoverPlay).length;
  const live = !gameFinal && (gameLive || plays.some((play) => play.is_live));
  const awaitingEnd = gameFinal && !hasEndGameEvent(plays);

  if (!plays.length && !injuryNotices.length) {
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
    <details className={styles.details} open={live || awaitingEnd || undefined}>
      <summary className={styles.summary}>
        <span className={styles.icon} aria-hidden="true">PBP</span>
        <span className={styles.summaryCopy}>
          <span className={styles.eyebrow}>{awaitingEnd ? "Final score — awaiting closing timeline entry" : live ? "Updating during the game" : gameFinal ? "Final game timeline" : "Every snap. Every swing."}</span>
          <strong>{awaitingEnd ? "Final play-by-play update pending" : live ? "Follow live play-by-play" : plays.length ? "Explore the complete play-by-play" : "View game injury notices"}</strong>
          <span>{plays.length.toLocaleString()} {live ? "live " : ""}play events across {driveCount.toLocaleString()} drives{injuryNotices.length ? ` · ${injuryNotices.length} injury ${injuryNotices.length === 1 ? "notice" : "notices"}` : ""}</span>
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
            <p>{!plays.length ? "Play-by-play has not arrived yet. Game injury notices are shown below as they are reported." : awaitingEnd ? `${away.name} at ${home.name} is final. The closing timeline entry has not arrived yet.` : live
              ? `${away.name} at ${home.name}, updating automatically on a best-effort basis.`
              : `${away.name} at ${home.name}, reconstructed from the opening kick through the final whistle.`}</p>
          </div>
          <div className={styles.scoreKey} aria-label="Teams">
            <span><i className={styles.awayDot} />{away.abbr}</span>
            <span><i className={styles.homeDot} />{home.abbr}</span>
          </div>
        </div>

        {injuryNotices.length ? (
          <section className={styles.injurySection} aria-labelledby="game-injury-notices-heading">
            <div className={styles.injuryHead}>
              <div>
                <p className={styles.eyebrow}>In-game updates</p>
                <h3 id="game-injury-notices-heading">Injury notices</h3>
              </div>
            </div>
            <ol className={styles.injuryList}>
              {injuryNotices.map((notice) => (
                <li className={styles.injuryNotice} key={`${notice.teamAbbr}-${notice.playerName}-${notice.reportedAt}`}>
                  <div className={styles.injuryIdentity}>
                    <strong>{notice.playerName}</strong>
                    <span>{notice.teamAbbr}</span>
                  </div>
                  <p>{notice.injuryLabel} <time dateTime={notice.reportedAt}>{reportedTime(notice.reportedAt)}</time></p>
                  <p className={notice.unresolved ? styles.injuryPending : styles.injuryResolved}>
                    {notice.status}
                    {notice.statusAt ? <> · <time dateTime={notice.statusAt}>{reportedTime(notice.statusAt)}</time></> : null}
                    {notice.sourceUrl ? <> · <a href={notice.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></> : null}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {plays.length ? <div className={styles.metrics} aria-label="Play-by-play summary">
          <div><strong>{plays.length.toLocaleString()}</strong><span>Events</span></div>
          <div><strong>{driveCount.toLocaleString()}</strong><span>Drives</span></div>
          <div><strong>{scoringCount.toLocaleString()}</strong><span>Scoring plays</span></div>
          <div><strong>{turnoverCount.toLocaleString()}</strong><span>Turnovers</span></div>
        </div> : null}

        <div className={styles.quarters}>
          {quarters.map(([quarter, quarterPlays]) => (
            <details className={styles.quarter} key={quarter ?? "notes"} open={quarter === currentQuarter || undefined}>
              <summary className={styles.quarterHead}>
                <span>{shortQuarterLabel(quarter)}</span>
                <div>
                  <h3 id={`quarter-${quarter ?? "notes"}`}>{quarterLabel(quarter)}</h3>
                  <p>{quarterPlays.length.toLocaleString()} events</p>
                </div>
                <span className={styles.quarterChevron} aria-hidden="true">⌄</span>
              </summary>

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
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}
