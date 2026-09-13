"use client";

import { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type TeamOption = {
  abbr: string;
  label: string;
};

type CoachOption = {
  coach_key: string;
  display_name: string;
};

type Props = {
  teams: TeamOption[];
  years: number[];
  coaches: CoachOption[];
  selectedTeam: string;
  selectedYear: string;
  selectedCoach: string;
  selectedSearch: string;
};

function updateQuery(
  pathname: string,
  current: URLSearchParams,
  updates: Record<string, string | null>,
  router: ReturnType<typeof useRouter>,
) {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }

  next.delete("page");
  const query = next.toString();
  startTransition(() => {
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  });
}

export function CoachBrowserControls({
  teams,
  years,
  coaches,
  selectedTeam,
  selectedYear,
  selectedCoach,
  selectedSearch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState(selectedTeam);
  const [year, setYear] = useState(selectedYear);
  const [coachKey, setCoachKey] = useState(selectedCoach);
  const [search, setSearch] = useState(selectedSearch);
  const [searchFocused, setSearchFocused] = useState(false);

  function matchesName(name: string, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return false;
    return name
      .toLowerCase()
      .split(/\s+/)
      .some((part) => part.startsWith(normalized));
  }

  const coachChoices = useMemo(
    () =>
      coaches.map((coach) => ({
        value: coach.coach_key,
        label: coach.display_name,
      })),
    [coaches],
  );

  const filteredNames = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized.length < 3) return [];
    return coaches
      .map((coach) => coach.display_name)
      .filter((name, index, all) => all.indexOf(name) === index)
      .filter((name) => matchesName(name, normalized))
      .slice(0, 12);
  }, [coaches, search]);

  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterGridFour}>
        <label className={styles.filterField}>
          <span>Team</span>
          <select id="coach-browser-team" value={team} onChange={(event) => setTeam(event.target.value)}>
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.abbr} value={team.abbr}>
                {team.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Season</span>
          <select id="coach-browser-year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All seasons</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Coach</span>
          <select
            id="coach-browser-name"
            value={coachKey}
            onChange={(event) => {
              setCoachKey(event.target.value);
              if (event.target.value) setSearch("");
            }}
          >
            <option value="">Any coach</option>
            {coachChoices.map((coach) => (
              <option key={coach.value} value={coach.value}>
                {coach.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.filterField} ${styles.searchField}`}>
          <span>Name search</span>
          <div className={styles.searchWrap}>
            <input
              id="coach-browser-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Start typing a coach name"
            />
            {searchFocused && filteredNames.length > 0 ? (
              <div className={styles.searchSuggestions} role="listbox" aria-label="Coach name suggestions">
                {filteredNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={styles.searchSuggestion}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSearch(name);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </label>
      </div>

      <div className={styles.filterActions}>
        <p>Team, season, coach, and name search all wait for apply.</p>
        <div className={styles.filterButtons}>
          <button
            type="button"
            className={styles.applyButton}
            onClick={() =>
              updateQuery(
                pathname,
                new URLSearchParams(searchParams.toString()),
                {
                  team: team || null,
                  year: year || null,
                  coach: coachKey || null,
                  search: coachKey ? null : (search.trim().length >= 3 ? search.trim() : null),
                },
                router,
              )
            }
          >
            Apply filters
          </button>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              setTeam("");
              setYear("");
              setCoachKey("");
              setSearch("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
}
