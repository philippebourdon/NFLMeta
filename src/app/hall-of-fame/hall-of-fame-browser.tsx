"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UiImage } from "@/components/ui-image";
import type { HallOfFamePageData } from "@/lib/hall-of-fame-data";
import { playerInitials } from "@/lib/player-initials";
import { TEAM_NAME, resolveTeamDisplayAbbr } from "@/lib/team-brand";
import styles from "./page.module.css";

function compactNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function formatMonitor(value: number | null) {
  if (value == null || value <= 0) return null;
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function HallOfFameBrowser({ data }: { data: HallOfFamePageData }) {
  const [selectedYear, setSelectedYear] = useState<number>(data.recentYear ?? data.years[0]?.electionYear ?? data.endYear);
  const year = useMemo(
    () => data.years.find((entry) => entry.electionYear === selectedYear) ?? data.years[0] ?? null,
    [data.years, selectedYear],
  );

  if (!year) return null;

  return (
    <section className={styles.yearsSection}>
      <div className={styles.yearPickerBar}>
        <div>
          <span className={styles.sectionKicker}>Browse By Year</span>
          <h2>{year.electionYear} class</h2>
        </div>
        <label className={styles.yearPicker}>
          <span>Election Year</span>
          <select
            id="hall-of-fame-election-year"
            value={year.electionYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
          >
            {data.years.map((entry) => (
              <option key={entry.electionYear} value={entry.electionYear}>
                {entry.electionYear}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={styles.yearCard}>
        <div className={styles.yearSummaryStatic}>
          <div>
            <span className={styles.yearLabel}>Election Year</span>
            <h2>{year.electionYear}</h2>
          </div>
          <div className={styles.yearCounts}>
            <div>
              <span>Nominees</span>
              <strong>{year.totalNominees}</strong>
            </div>
            <div>
              <span>Inductees</span>
              <strong>{year.inducteeCount}</strong>
            </div>
          </div>
        </div>

        <div className={styles.groupStack}>
          {year.groups.map((group) => (
            <section key={group.key} className={styles.groupCard}>
              <div className={styles.groupHeader}>
                <div>
                  <span className={styles.groupEyebrow}>{group.label}</span>
                  <h3>{formatRole(group.role)} ballot</h3>
                </div>
                <strong>{group.nominees.length}</strong>
              </div>

              <div className={styles.nomineeGrid}>
                {group.nominees.map((nominee) => {
                  const teamAbbr = nominee.latestTeamAbbr
                    ? resolveTeamDisplayAbbr(nominee.latestTeamAbbr, nominee.electionYear)
                    : null;
                  const teamName = teamAbbr ? TEAM_NAME[teamAbbr] || teamAbbr : null;
                  const cardContent = (
                    <>
                      <div className={styles.nomineeHead}>
                        {nominee.headshotUrl ? (
                          <UiImage
                            src={nominee.headshotUrl}
                            alt={nominee.nomineeName}
                            className={`${styles.nomineeHeadshot} ${nominee.nomineeName === "Roger Craig" ? styles.nomineeHeadshotRogerCraig : ""}`}
                            width={108}
                            height={108}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.nomineeFallback}>{playerInitials(nominee.nomineeName)}</div>
                        )}
                        <div className={styles.nomineeMeta}>
                          <div className={styles.nomineeBadges}>
                            {nominee.isInductee ? <span className={styles.inductedBadge}>Inducted</span> : null}
                            <span>{formatRole(nominee.role)}</span>
                            {nominee.ballotType ? <span>{nominee.ballotType}</span> : null}
                          </div>
                          <strong>{nominee.nomineeName}</strong>
                          {teamName ? <p>{teamName}</p> : <p>{formatRole(nominee.role)}</p>}
                        </div>
                      </div>
                      <div className={styles.nomineeStats}>
                        {nominee.hofMonitor != null ? (
                          <div>
                            <span>HOF Monitor</span>
                            <strong>{formatMonitor(nominee.hofMonitor)}</strong>
                          </div>
                        ) : null}
                        {nominee.gamesPlayed != null ? (
                          <div>
                            <span>Games</span>
                            <strong>{compactNumber(nominee.gamesPlayed)}</strong>
                          </div>
                        ) : null}
                        {nominee.proBowls != null ? (
                          <div>
                            <span>Pro Bowls</span>
                            <strong>{compactNumber(nominee.proBowls)}</strong>
                          </div>
                        ) : null}
                        {nominee.allProsFirstTeam != null ? (
                          <div>
                            <span>1st Team AP</span>
                            <strong>{compactNumber(nominee.allProsFirstTeam)}</strong>
                          </div>
                        ) : null}
                        {nominee.championships != null ? (
                          <div>
                            <span>Titles</span>
                            <strong>{compactNumber(nominee.championships)}</strong>
                          </div>
                        ) : null}
                      </div>
                    </>
                  );

                  const href = nominee.playerKey
                    ? `/players/${encodeURIComponent(nominee.playerKey)}`
                    : nominee.coachKey
                      ? `/coaches/${encodeURIComponent(nominee.coachKey)}`
                      : nominee.contributorKey
                        ? `/contributors/${encodeURIComponent(nominee.contributorKey)}`
                        : nominee.executiveKey
                          ? `/executives/${encodeURIComponent(nominee.executiveKey)}`
                          : null;

                  return href ? (
                    <Link
                      key={nominee.id}
                      href={href}
                      className={`${styles.nomineeCard} ${nominee.isInductee ? styles.nomineeCardInducted : ""}`}
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <article
                      key={nominee.id}
                      className={`${styles.nomineeCard} ${nominee.isInductee ? styles.nomineeCardInducted : ""}`}
                    >
                      {cardContent}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}
