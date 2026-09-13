import type { MetadataRoute } from "next";
import { gameDirectoryHref, listGameSitemapEntries } from "@/lib/game-directory-data";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await listGameSitemapEntries(false);
  return games.map(game => ({ url: siteUrl(gameDirectoryHref(game)), changeFrequency: "daily" }));
}
