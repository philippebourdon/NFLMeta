"use client";

import { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type Props = {
  teams: Array<{ abbr: string; label: string }>;
  years: number[];
  owners: Array<{ executive_key: string; display_name: string }>;
  selectedTeam: string;
  selectedYear: string;
  selectedOwner: string;
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

  startTransition(() => {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  });
}

function matchesName(name: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return name
    .toLowerCase()
    .split(/\s+/)
    .some((part) => part.startsWith(normalized));
}

export function OwnersBrowserControls({
  teams,
  years,
  owners,
  selectedTeam,
  selectedYear,
  selectedOwner,
  selectedSearch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState(selectedTeam);
  const [year, setYear] = useState(selectedYear);
  const [ownerKey, setOwnerKey] = useState(selectedOwner);
  const [search, setSearch] = useState(selectedSearch);
  const [searchFocused, setSearchFocused] = useState(false);

  const ownerChoices = useMemo(
    () =>
      owners.map((owner) => ({
        value: owner.executive_key,
        label: owner.display_name,
      })),
    [owners],
  );

  const suggestions = useMemo(() => {
    const normalized = search.trim();
    if (normalized.length < 3) return [];
    return owners
      .map((owner) => owner.display_name)
      .filter((name, index, all) => all.indexOf(name) === index)
      .filter((name) => matchesName(name, normalized))
      .slice(0, 12);
  }, [owners, search]);

  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterGridFour}>
        <label className={styles.filterField}>
          <span>Team</span>
          <select id="owners-browser-team" value={team} onChange={(event) => setTeam(event.target.value)}>
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
          <select id="owners-browser-year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All seasons</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Owner</span>
          <select
            id="owners-browser-name"
            value={ownerKey}
            onChange={(event) => {
              setOwnerKey(event.target.value);
              if (event.target.value) setSearch("");
            }}
          >
            <option value="">Any owner</option>
            {ownerChoices.map((owner) => (
              <option key={owner.value} value={owner.value}>
                {owner.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.filterField} ${styles.searchField}`}>
          <span>Owner search</span>
          <div className={styles.searchWrap}>
            <input
              id="owners-browser-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Start typing an owner name"
            />
            {searchFocused && suggestions.length > 0 ? (
              <div className={styles.searchSuggestions} role="listbox" aria-label="Owner suggestions">
                {suggestions.map((name) => (
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
        <p>Team, season, owner, and name search all wait for apply.</p>
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
                  owner: ownerKey || null,
                  search: ownerKey ? null : (search.trim().length >= 3 ? search.trim() : null),
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
              setOwnerKey("");
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
