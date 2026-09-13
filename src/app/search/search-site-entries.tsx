"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SiteSearchEntry } from "@/lib/site-search";
import styles from "./page.module.css";

type Props = {
  entries: SiteSearchEntry[];
};

function labelForKind(kind: SiteSearchEntry["kind"]): string {
  switch (kind) {
    case "endpoint":
      return "Endpoint";
    case "recipe":
      return "Recipe";
    case "identifier":
      return "Identifier";
    case "starter":
      return "Quickstart";
    default:
      return "Page";
  }
}

export function SearchSiteEntries({ entries }: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "site" | "docs">("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (scope !== "all" && entry.scope !== scope) return false;
      if (!normalized) return true;
      return [entry.title, entry.description, entry.code || "", ...entry.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [entries, query, scope]);

  return (
    <>
      <section className={styles.searchCard}>
        <span className={styles.eyebrow}>Search</span>
        <h2>Search Pages, Docs, Recipes, And Endpoints</h2>
        <p>Use one search surface for pricing, trust, status, installation, FAQ, and the full API docs system.</p>
        <input
          id="site-search-input"
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pricing, weather, player_key, status, venue_key, changelog..."
          aria-label="Search NFLMeta site"
        />
        <div className={styles.chipRow} aria-label="Search scopes">
          {(["all", "site", "docs"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.chip} ${scope === value ? styles.chipActive : ""}`}
              onClick={() => setScope(value)}
            >
              {value === "all" ? "All" : value === "site" ? "Site Pages" : "Docs"}
            </button>
          ))}
        </div>
        <div className={styles.hintRow}>
          {["pricing", "status", "game id", "player_key", "weather", "quota"].map((hint) => (
            <button key={hint} type="button" className={styles.hint} onClick={() => setQuery(hint)}>
              {hint}
            </button>
          ))}
        </div>
        <small className={styles.meta}>
          {query ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}` : `${entries.length} searchable entries`}
        </small>
      </section>

      {filtered.length > 0 ? (
        <section className={styles.results}>
          {filtered.map((entry) => (
            <Link
              key={`${entry.scope}-${entry.kind}-${entry.href}-${entry.title}`}
              href={entry.href}
              prefetch={false}
              className={styles.resultCard}
            >
              <div className={styles.topRow}>
                <span className={styles.eyebrow}>{entry.scope === "site" ? "Site" : labelForKind(entry.kind)}</span>
                <strong>{entry.title}</strong>
              </div>
              <p>{entry.description}</p>
              {entry.code ? <code className={styles.code}>{entry.code}</code> : null}
            </Link>
          ))}
        </section>
      ) : (
        <article className={styles.emptyCard}>
          <span className={styles.eyebrow}>No Matches</span>
          <h2>No NFLMeta pages matched that search</h2>
          <p>Try a broader keyword like <code>pricing</code>, <code>weather</code>, <code>status</code>, or an identifier term like <code>player_key</code>.</p>
        </article>
      )}
    </>
  );
}
