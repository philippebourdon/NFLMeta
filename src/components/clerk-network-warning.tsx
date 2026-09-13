type ClerkNetworkWarningProps = {
  title: string;
  detail?: string;
};

export default function ClerkNetworkWarning({ title, detail }: ClerkNetworkWarningProps) {
  return (
    <section className="stack" style={{ gap: "1rem" }}>
      <article className="card">
        <p className="kicker">Restricted Host</p>
        <h1>{title}</h1>
        <p className="muted">
          {detail || "Clerk authentication is disabled on this host. Open this page on the approved NFLMeta auth host to use sign-in, sign-up, and account management."}
        </p>
      </article>
      <article className="card">
        <h2>What To Try</h2>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.45rem" }}>
          <li>Use the same route on the approved NFLMeta auth host.</li>
          <li>Keep using public docs and API pages on this host if you do not need account access.</li>
          <li>If this LAN host should support Clerk, update the Clerk host/origin configuration first.</li>
        </ul>
      </article>
    </section>
  );
}
