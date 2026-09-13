import { StatusPage } from "@/components/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      kicker="Page Not Found"
      title="That route ran the wrong play."
      message="The page you asked for is not on the field anymore. It may have moved, been renamed, or never made the final roster."
      meta={[
        "No page was found for this URL",
        "Try the main browsers or the API docs",
        "The scoreboard still works, this route just does not",
      ]}
      tipsTitle="What To Try"
      tips={[
        "Check the URL for typos, missing slashes, or an old identifier.",
        "If you were looking for data, start from Teams, Players, Coaches, Schedule, or API Docs.",
        "If you followed an old bookmark, the route may have changed while the site got rebuilt.",
      ]}
      actionsTitle="Recommended Next Snap"
      actionsBody="Start from a known good route and work inward. That is faster than arguing with a dead link."
      actions={[
        { href: "/", label: "Go Home", primary: true },
        { href: "/api-docs", label: "API Docs" },
        { href: "/teams", label: "Teams" },
        { href: "/faq", label: "FAQ" },
      ]}
    />
  );
}
