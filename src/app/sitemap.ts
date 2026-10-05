import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

/**
 * Sitemap for the public reference surface.
 *
 * Regenerated daily rather than per request: it is roughly 35,000 URLs and
 * four queries, which is cheap once a day and wasteful on every crawl.
 *
 * Game detail pages are in /games/sitemap.xml and /playoff_games/sitemap.xml,
 * both advertised in robots.txt. This keeps each sitemap below its URL limit.
 */
export const revalidate = 86_400;

type Row = { key: string; updated: Date | string | null };

const STATIC_PATHS: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1.0, freq: "daily" },
  { path: "/database", priority: 0.8, freq: "weekly" },
  { path: "/research", priority: 0.8, freq: "weekly" },
  { path: "/teams", priority: 0.9, freq: "weekly" },
  { path: "/players", priority: 0.9, freq: "daily" },
  { path: "/players/directory", priority: 0.7, freq: "daily" },
  { path: "/coaches", priority: 0.7, freq: "weekly" },
  { path: "/owners", priority: 0.5, freq: "monthly" },
  { path: "/schedule", priority: 0.8, freq: "daily" },
  { path: "/games/directory", priority: 0.8, freq: "daily" },
  { path: "/scores", priority: 0.8, freq: "daily" },
  { path: "/depth-charts", priority: 0.7, freq: "daily" },
  { path: "/injuries", priority: 0.7, freq: "daily" },
  { path: "/transactions", priority: 0.7, freq: "daily" },
  { path: "/standings", priority: 0.8, freq: "daily" },
  { path: "/seasons", priority: 0.7, freq: "weekly" },
  { path: "/rosters", priority: 0.6, freq: "weekly" },
  { path: "/draft-picks", priority: 0.6, freq: "weekly" },
  { path: "/super-bowls", priority: 0.7, freq: "monthly" },
  { path: "/hall-of-famers", priority: 0.6, freq: "monthly" },
  { path: "/hall-of-fame", priority: 0.5, freq: "monthly" },
  { path: "/nfl-top-100", priority: 0.6, freq: "weekly" },
  { path: "/playoff-picture", priority: 0.6, freq: "daily" },
  { path: "/stadium-histories", priority: 0.5, freq: "monthly" },
  { path: "/team-logo-histories", priority: 0.5, freq: "monthly" },
  { path: "/search", priority: 0.4, freq: "monthly" },
  // Product and documentation
  { path: "/plex", priority: 0.8, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "monthly" },
  { path: "/mcp-access", priority: 0.9, freq: "monthly" },
  { path: "/api-docs", priority: 0.9, freq: "weekly" },
  { path: "/api-docs/print-guide", priority: 0.6, freq: "monthly" },
  { path: "/api-docs/quickstart", priority: 0.8, freq: "monthly" },
  { path: "/api-docs/analytics", priority: 0.8, freq: "monthly" },
  { path: "/demo", priority: 0.8, freq: "monthly" },
  { path: "/api-docs/authentication", priority: 0.7, freq: "monthly" },
  { path: "/api-docs/identifiers", priority: 0.6, freq: "monthly" },
  { path: "/api-docs/core-endpoints", priority: 0.7, freq: "monthly" },
  { path: "/api-docs/reference-data", priority: 0.6, freq: "monthly" },
  { path: "/api-docs/recipes", priority: 0.6, freq: "monthly" },
  { path: "/api-docs/changelog", priority: 0.5, freq: "weekly" },
  { path: "/api-docs/sdk", priority: 0.6, freq: "monthly" },
  { path: "/sdk", priority: 0.7, freq: "monthly" },
  { path: "/installation", priority: 0.6, freq: "monthly" },
  { path: "/installation/capabilities", priority: 0.7, freq: "weekly" },
  { path: "/use-cases", priority: 0.7, freq: "monthly" },
  { path: "/use-cases/fantasy-game-day", priority: 0.8, freq: "weekly" },
  { path: "/faq", priority: 0.7, freq: "monthly" },
  { path: "/about", priority: 0.6, freq: "monthly" },
  { path: "/trust", priority: 0.5, freq: "monthly" },
  { path: "/status", priority: 0.4, freq: "daily" },
  { path: "/changelog", priority: 0.4, freq: "weekly" },
  { path: "/enterprise-controls", priority: 0.4, freq: "monthly" },
  { path: "/requests", priority: 0.4, freq: "monthly" },
  { path: "/contact", priority: 0.4, freq: "monthly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
];

function lastModified(value: Date | string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [teams, seasons, superBowls, coaches, players] = await Promise.all([
    query<{ key: string }>(`SELECT nfl_abbr AS key FROM teams WHERE nfl_abbr IS NOT NULL ORDER BY nfl_abbr`),
    query<{ key: string }>(`SELECT year::text AS key FROM seasons ORDER BY year DESC`),
    query<{ key: string }>(
      `SELECT DISTINCT season_year::text AS key
         FROM playoff_games
        WHERE round ILIKE '%super%' AND season_year IS NOT NULL
        ORDER BY 1 DESC`,
    ),
    query<Row>(
      `SELECT coach_key AS key, NULL::timestamptz AS updated
         FROM coaches WHERE coach_key IS NOT NULL ORDER BY coach_key`,
    ),
    query<Row>(
      `SELECT player_key AS key, updated_at AS updated
         FROM players WHERE player_key IS NOT NULL AND canonical_player_id IS NULL ORDER BY player_key`,
    ),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((item) => ({
    url: siteUrl(item.path),
    lastModified: now,
    changeFrequency: item.freq,
    priority: item.priority,
  }));

  for (const team of teams) {
    entries.push({ url: siteUrl(`/teams/${team.key}`), lastModified: now, changeFrequency: "daily", priority: 0.8 });
    entries.push({ url: siteUrl(`/teams/${team.key}/recent`), lastModified: now, changeFrequency: "daily", priority: 0.5 });
    entries.push({ url: siteUrl(`/teams/${team.key}/staff`), lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    entries.push({
      url: siteUrl(`/super-bowls/teams/${team.key}`),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    });
  }

  for (const season of seasons) {
    entries.push({
      url: siteUrl(`/seasons?season_year=${season.key}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  for (const sb of superBowls) {
    entries.push({
      url: siteUrl(`/super-bowls/${sb.key}`),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }

  for (const coach of coaches) {
    entries.push({
      url: siteUrl(`/coaches/${coach.key}`),
      lastModified: lastModified(coach.updated, now),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const player of players) {
    entries.push({
      url: siteUrl(`/players/${player.key}`),
      lastModified: lastModified(player.updated, now),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
