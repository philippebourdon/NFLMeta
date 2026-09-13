import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site-url";

/**
 * Crawl rules for the public reference site.
 *
 * This file used to return a blanket `disallow: "/"`, which de-indexed roughly
 * ninety page types -- every team, player, coach, season and Super Bowl page --
 * and with them the only organic acquisition channel the product has.
 *
 * Worse, it was invisible in production. Cloudflare prepends its own managed
 * block containing `Allow: /`, so the served file carried two `User-agent: *`
 * groups; crawlers that merge same-agent groups (Google does) took the
 * `Disallow` and dropped the site. A working site proved nothing.
 *
 * The rule now allows the content and names the surfaces that must stay out of
 * an index: anything behind auth, the JSON API (it needs a key, and indexed
 * error envelopes help nobody), and the interstitials that exist to be
 * redirected to rather than found.
 */
// AI-training crawlers to keep out of the site. Same list Cloudflare's
// deprecating "Block AI bots" feature was managing on our behalf; moved here
// so the block survives that deprecation and the served robots.txt no longer
// carries Cloudflare's Content-Signal preamble (an unknown directive Google
// flags as an error). Well-behaved crawlers honour a Disallow; the badly
// behaved ones ignore any robots.txt rule regardless of who wrote it.
const AI_TRAINING_BOTS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "GPTBot",
  "Google-Extended",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/customer-portal",
          "/customer-portal/",
          "/register",
          // Sign-in must be crawlable so search engines can read its noindex.
          "/sign-up",
          "/auth/",
          "/design/",
          "/forbidden",
          "/maintenance",
          "/quota-exceeded",
          "/subscription-required",
          "/too-many-requests",
        ],
      },
      ...AI_TRAINING_BOTS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/games/sitemap.xml`, `${base}/playoff_games/sitemap.xml`],
  };
}
