"use client";

import { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

type Props = {
  names: string[];
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

export function HallOfFamersBrowserControls({ names, selectedSearch }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(selectedSearch);
  const [searchFocused, setSearchFocused] = useState(false);

  const suggestions = useMemo(() => {
    const normalized = search.trim();
    if (normalized.length < 3) return [];
    return names.filter((name) => matchesName(name, normalized)).slice(0, 12);
  }, [names, search]);

  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterGridSingle}>
        <label className={`${styles.filterField} ${styles.searchField}`}>
          <span>Hall of Famer search</span>
          <div className={styles.searchWrap}>
            <input
              id="hall-of-famers-browser-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              placeholder="Start typing a Hall of Famer name"
            />
            {searchFocused && suggestions.length > 0 ? (
              <div className={styles.searchSuggestions} role="listbox" aria-label="Hall of Famer suggestions">
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
        <p>Type a name, then apply the search when you are ready.</p>
        <div className={styles.filterButtons}>
          <button
            type="button"
            className={styles.applyButton}
            onClick={() =>
              updateQuery(
                pathname,
                new URLSearchParams(searchParams.toString()),
                { search: search.trim().length >= 3 ? search.trim() : null },
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
