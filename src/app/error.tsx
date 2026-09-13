"use client";

import { StatusPage } from "@/components/status-page";

export default function GlobalError() {
  return (
    <main className="container">
      <StatusPage
        code="500"
        kicker="Unexpected Error"
        title="The play call broke in the huddle."
        message="Something went sideways before the page could finish rendering. The system is still alive; this request just took a sack."
        meta={[
          "This was an unexpected application error",
          "Refreshing may fix transient failures",
          "Persistent failures are worth reporting",
        ]}
        tipsTitle="What To Try"
        tips={[
          "Refresh once in case this was a temporary render or network issue.",
          "If you were deep-linking into a specific record, try navigating from the main browser first.",
          "If the same error repeats, send the route and what you were doing to support.",
        ]}
        actionsTitle="Recommended Next Snap"
        actionsBody="Reset the drive and retry from a stable route. If it breaks twice, it is probably not you."
        actions={[
          { href: "/", label: "Go Home", primary: true },
          { href: "/status", label: "Status" },
          { href: "/contact", label: "Contact" },
        ]}
      />
    </main>
  );
}
