"use client";

/**
 * Last-resort error page.
 *
 * error.tsx only renders once the root layout has succeeded. When the failure
 * is in the layout itself -- or in the short window after a restart where the
 * client reference manifest for a route is not yet on disk -- Next falls back
 * to a bare unstyled shell, because this project has no pages/500.html either.
 * global-error.tsx replaces its own <html>, so it stays legible without the
 * layout, the fonts, or the stylesheet having loaded.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1220",
          color: "#e8eef7",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: "34rem", padding: "2rem", textAlign: "center" }}>
          <p style={{ margin: 0, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: "0.75rem", color: "#7d93b2" }}>
            Unexpected Error
          </p>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.75rem", lineHeight: 1.2, textWrap: "balance" }}>
            The play call broke in the huddle.
          </h1>
          <p style={{ margin: "1rem 0 0", color: "#b9c7db", lineHeight: 1.6 }}>
            Something failed before the page could render. This is usually transient, and
            a refresh is worth trying first.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.7rem 1.4rem",
              borderRadius: "0.5rem",
              border: "1px solid #2c405f",
              background: "#16233a",
              color: "#e8eef7",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
