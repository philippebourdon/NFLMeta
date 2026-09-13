"use client";

import { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type TeamOption = {
  abbr: string;
  label: string;
};

type PlayerOption = {
  player_key: string;
  display_name: string;
};

type Props = {
  teams: TeamOption[];
  years: number[];
  players: PlayerOption[];
  positions: string[];
  jerseyNumbers: string[];
  selectedTeam: string;
  selectedYear: string;
  selectedPlayer: string;
  selectedSearch: string;
  selectedPosition: string;
  selectedJersey: string;
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

export function PlayerBrowserControls({
  teams,
  years,
  players,
  positions,
  jerseyNumbers,
  selectedTeam,
  selectedYear,
  selectedPlayer,
  selectedSearch,
  selectedPosition,
  selectedJersey,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState(selectedTeam);
  const [year, setYear] = useState(selectedYear);
  const [playerKey, setPlayerKey] = useState(selectedPlayer);
  const [search, setSearch] = useState(selectedSearch);
  const [position, setPosition] = useState(selectedPosition);
  const [jersey, setJersey] = useState(selectedJersey);
  const [searchFocused, setSearchFocused] = useState(false);

  function matchesName(name: string, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return false;
    return name
      .toLowerCase()
      .split(/\s+/)
      .some((part) => part.startsWith(normalized));
  }

  const playerChoices = useMemo(
    () =>
      players.map((player) => ({
        value: player.player_key,
        label: player.display_name,
      })),
    [players],
  );

  const filteredNames = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized.length < 3) return [];
    return players
      .map((player) => player.display_name)
      .filter((name, index, all) => all.indexOf(name) === index)
      .filter((name) => matchesName(name, normalized))
      .slice(0, 12);
  }, [players, search]);

  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterGrid}>
        <label className={styles.filterField}>
          <span>Team</span>
          <select id="player-browser-team" value={team} onChange={(event) => setTeam(event.target.value)}>
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
          <select id="player-browser-year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All seasons</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Player</span>
          <select
            id="player-browser-name"
            value={playerKey}
            onChange={(event) => {
              setPlayerKey(event.target.value);
              if (event.target.value) setSearch("");
            }}
          >
            <option value="">Any player</option>
            {playerChoices.map((player) => (
              <option key={player.value} value={player.value}>
                {player.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.filterField} ${styles.searchField}`}>
          <span>Name search</span>
          <div className={styles.searchWrap}>
            <input
              id="player-browser-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Start typing a player name"
            />
            {searchFocused && filteredNames.length > 0 ? (
              <div className={styles.searchSuggestions} role="listbox" aria-label="Player name suggestions">
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

        <label className={styles.filterField}>
          <span>Position</span>
          <select id="player-browser-position" value={position} onChange={(event) => setPosition(event.target.value)}>
            <option value="">All positions</option>
            {positions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Jersey</span>
          <select id="player-browser-jersey" value={jersey} onChange={(event) => setJersey(event.target.value)}>
            <option value="">All numbers</option>
            {jerseyNumbers.map((value) => (
              <option key={value} value={value}>
                #{value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.filterActions}>
        <p>Team, season, player, and name search all wait for apply.</p>
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
                  player: playerKey || null,
                  search: playerKey ? null : (search.trim().length >= 3 ? search.trim() : null),
                  position: position || null,
                  jersey: jersey || null,
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
              setPlayerKey("");
              setSearch("");
              setPosition("");
              setJersey("");
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
