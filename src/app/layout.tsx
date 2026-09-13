import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import ClerkProviderShell from "@/components/clerk-provider-shell";
import HeaderAccountActions from "@/components/header-account-actions";
import HeaderNav, { type HeaderNavGroup } from "@/components/header-nav";
import { productReleases } from "@/lib/product-releases";
import SiteAnalyticsTracker from "@/components/site-analytics-tracker";
import { UiImage } from "@/components/ui-image";
import { siteBaseUrl } from "@/lib/site-url";
import "./globals.css";
import "./prod-parity.css";
import "./professional-theme.css";

const ibmSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-sans",
});

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl()),
  title: {
    default: "NFLMeta: Connected NFL Data Platform and API",
    template: "%s | NFLMeta",
  },
  description: "Browse connected NFL history and current league data, or build with the NFLMeta API and official SDKs.",
  openGraph: {
    type: "website",
    siteName: "NFLMeta",
    title: "NFLMeta: Connected NFL Data Platform and API",
    description:
      "Explore players, teams, rosters, games, live scores, standings and historical play-by-play through the public site or documented API.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "NFLMeta: Connected NFL Data Platform and API",
    description:
      "Explore players, teams, rosters, games, live scores, standings and historical play-by-play through the public site or documented API.",
  },
  icons: {
    icon: [
      { url: "/brand/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/brand/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/icon.png", sizes: "512x512" }],
  },
};

const navGroups: HeaderNavGroup[] = [
  {
    label: "What's New",
    href: "/changelog",
    className: "nav-seasons",
    items: [
      ...productReleases.slice(0, 3).map(release => ({ href: `/changelog#v${release.version}`, label: `v${release.version}`, description: release.title })),
      { href: "/changelog", label: "All Updates", description: "New features, API endpoints, MCP tools, improvements, and fixes." },
    ],
  },
  {
    label: "Database",
    href: "/database",
    className: "nav-seasons",
    items: [
      { href: "/database", label: "Explore Database", description: "Browse players, teams, games, rosters and league history." },
      { href: "/research", label: "NFL Research", description: "Compare player efficiency, situations, and historical season trends." },
    ],
  },
  {
    label: "Teams",
    href: "/teams",
    className: "nav-teams",
    items: [
      { href: "/teams", label: "All Teams", description: "Franchise pages, logos, and team history." },
      { href: "/scores", label: "Live Scores", description: "Free, best-effort scores and game status updates." },
      { href: "/schedule", label: "Schedule", description: "Weekly schedule and game detail views." },
      { href: "/depth-charts", label: "Depth Charts", description: "Current starters, position depth, and recent movement." },
      { href: "/injuries", label: "Injury Reports", description: "Weekly injury designations and practice participation." },
      { href: "/transactions", label: "Transactions", description: "Signings, releases, trades, and roster movement." },
    ],
  },
  {
    label: "People",
    href: "/players",
    className: "nav-teams",
    items: [
      { href: "/players", label: "Player Browser", description: "Search player profiles and career data." },
      { href: "/rosters", label: "Rosters", description: "Browse roster snapshots by team and season." },
      { href: "/draft-picks", label: "Draft Picks", description: "Browse draft picks by year, team, round, and player." },
      { href: "/coaches", label: "Coach Browser", description: "Browse coaching history and bios." },
      { href: "/owners", label: "Owner Browser", description: "Search NFL owners and ownership leadership." },
      { href: "/hall-of-famers", label: "Hall of Famers", description: "Browse inducted players, coaches, and contributors." },
    ],
  },
  {
    label: "History",
    href: "/super-bowls",
    className: "nav-standings",
    items: [
      { href: "/seasons", label: "Seasons", description: "Season-by-season historical summaries and context." },
      { href: "/super-bowls", label: "Super Bowls", description: "Championship history and winners." },
      { href: "/nfl-top-100", label: "NFL Top 100", description: "Annual player-voted Top 100 rankings and stat context." },
      { href: "/standings", label: "Season Standings", description: "Standings snapshots by season." },
      { href: "/playoff-picture", label: "Playoff Picture", description: "Postseason context and bracket views." },
    ],
  },
  {
    label: "API",
    href: "/api-docs",
    className: "nav-seasons",
    items: [
      { href: "/api-docs/playground", label: "Try the API", description: "No signup or key. Run editable, small historical demo examples.", tone: "primary" },
      { href: "/faq", label: "FAQ", description: "Integration answers, coverage, and onboarding guidance." },
      {
        href: "/api-docs",
        label: "Documentation",
        description: "Endpoint reference and request examples.",
      },
      { href: "/sdk", label: "SDKs", description: "Official TypeScript and Python clients for the NFLMeta API." },
      { href: "/mcp-access", label: "AI / MCP", description: "Paid, read-only football research tools for Claude and Codex.", tone: "primary" },
      { href: "/use-cases", label: "Use Cases", description: "Ideas for apps, media products, research tools, and custom work." },
      { href: "/requests", label: "Request Board", description: "Request stats, endpoints, and product additions." },
      { href: "/search", label: "Search", description: "Search docs, pricing, trust, status, and setup pages." },
      { href: "/trust", label: "Trust", description: "Security, uptime, and platform controls." },
      { href: "/pricing", label: "Pricing", description: "Plans, access tiers, and usage guidance." },
    ],
  },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body className={`${ibmSans.variable} ${ibmMono.variable}`}>
        <ClerkProviderShell>
          <Suspense fallback={null}>
            <SiteAnalyticsTracker />
          </Suspense>
          <header className="header">
            <div className="container header-bar">
              <strong className="brand">
                <Link href="/" aria-label="NFLMeta Home">
                  <UiImage
                    src="/hero_main/NFLMeta_Logo.png"
                    alt="NFLMeta"
                    className="brand-logo"
                    width={715}
                    height={126}
                    loading="lazy"
                  />
                </Link>
              </strong>
              <HeaderNav groups={navGroups} />
              <div className="header-actions">
                <Link href="/search" className="nav-search" aria-label="Search NFLMeta" title="Search NFLMeta">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="10.75" cy="10.75" r="6.75" />
                    <path d="m16 16 4.25 4.25" />
                  </svg>
                </Link>
                <HeaderAccountActions />
                <div className="nav-logo">
                  <UiImage
                    src="/brand/nfl-shield.png"
                    alt="NFL"
                    className="nav-nfl-logo"
                    width={36}
                    height={36}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </header>
          <main className="container">{children}</main>
          <footer className="footer">
            <div className="container footer-bar">
              <p className="footer-copy">
                © {currentYear} NFLMeta. SportDBX is the parent company of NFLMeta.
              </p>
              <Link href="/" className="footer-brand" aria-label="NFLMeta Home">
                <UiImage
                  src="/hero_main/NFLMeta_Logo.png"
                  alt="NFLMeta"
                  className="footer-logo"
                  width={715}
                  height={126}
                  loading="lazy"
                />
              </Link>
              <div className="footer-links">
                <Link href="/about">About</Link>
                <span>·</span>
                <Link href="/about#data-sources">Data Sources</Link>
                <span>·</span>
                <Link href="/status">Status</Link>
                <span>·</span>
                <Link href="/pricing">Pricing</Link>
                <span>·</span>
                <Link href="/mcp-access">AI / MCP</Link>
                <span>·</span>
                <Link href="/terms">Terms of Service</Link>
                <span>·</span>
                <Link href="/privacy">Privacy</Link>
                <span>·</span>
                <a href="mailto:info@sportsdbx.com" aria-label="Email SportDBX">
                  <svg viewBox="0 0 24 24" className="footer-mail-icon" aria-hidden="true">
                    <path d="M3 6h18v12H3z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </a>
              </div>
            </div>
          </footer>
        </ClerkProviderShell>
      </body>
    </html>
  );
}
