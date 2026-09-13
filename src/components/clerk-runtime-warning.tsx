type ClerkRuntimeWarningProps = {
  title: string;
  detail?: string;
};

export default function ClerkRuntimeWarning({ title, detail }: ClerkRuntimeWarningProps) {
  return (
    <section className="stack" style={{ gap: "1rem" }}>
      <article className="card">
        <p className="kicker">Authentication Unavailable</p>
        <h1>{title}</h1>
        <p className="muted">
          {detail || "Clerk authentication is temporarily unavailable on this host right now. The page did not crash, but sign-in state could not be loaded."}
        </p>
      </article>
      <article className="card">
        <h2>What To Try</h2>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.45rem" }}>
          <li>Reload after clearing cookies/site data for this host.</li>
          <li>Try the same route again after a clean sign-in.</li>
          <li>Verify the Clerk publishable and secret keys belong to the same instance if it keeps failing.</li>
        </ul>
      </article>
    </section>
  );
}
