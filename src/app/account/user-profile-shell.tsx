"use client";

import Link from "next/link";
import { UserProfile, useUser } from "@clerk/nextjs";

function DangerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path
        d="M12 3.75 21 19.5H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export default function UserProfileShell() {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && !isSignedIn) {
    return (
      <section className="stack" style={{ gap: "0.9rem" }}>
        <article
          style={{
            borderRadius: "18px",
            border: "1px solid rgba(122, 173, 230, 0.24)",
            background: "rgba(11, 30, 49, 0.8)",
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: 0, color: "#ffffff" }}>Account session ended</h2>
          <p style={{ margin: "0.7rem 0 0", color: "#d7e9fb" }}>
            If you just deleted your account, the sign-in session has already been cleared.
          </p>
          <p style={{ margin: "0.7rem 0 0", color: "#d7e9fb" }}>
            <Link href="/sign-in" style={{ color: "#8ec4ff" }}>Return to sign in</Link>
          </p>
        </article>
      </section>
    );
  }

  return (
    <UserProfile
      routing="hash"
      appearance={{
        elements: {
          rootBox: {
            width: "100%",
          },
          card: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
          },
          navbar: {
            background: "rgba(8, 24, 40, 0.98)",
          },
          navbarButton: {
            color: "#eef6ff",
          },
          navbarButtonIcon: {
            color: "#8ec4ff",
          },
          profileSection: {
            background: "rgba(11, 30, 49, 0.8)",
            border: "1px solid rgba(122, 173, 230, 0.24)",
            borderRadius: "18px",
            overflow: "hidden",
          },
          profileSectionTitleText: {
            color: "#ffffff",
          },
          profileSectionSubtitleText: {
            color: "#d7e9fb",
          },
          formFieldLabel: {
            color: "#eef6ff",
          },
          formFieldInput: {
            background: "rgba(13, 34, 56, 0.98)",
            border: "1px solid rgba(113, 165, 219, 0.38)",
            color: "#ffffff",
          },
          formFieldHintText: {
            color: "#d7e9fb",
          },
          userPreviewMainIdentifier: {
            color: "#ffffff",
          },
          userPreviewSecondaryIdentifier: {
            color: "#d7e9fb",
          },
          formButtonPrimary: {
            background: "linear-gradient(180deg, #4ca2f2, #2c6eb4)",
            color: "#ffffff",
          },
        },
      }}
    >
      <UserProfile.Page label="Delete Account" url="danger" labelIcon={<DangerIcon />}>
        <section className="stack" style={{ gap: "0.9rem" }}>
          <article
            style={{
              borderRadius: "18px",
              border: "1px solid rgba(192, 94, 94, 0.28)",
              background: "linear-gradient(180deg, rgba(48, 18, 22, 0.72), rgba(25, 10, 13, 0.84))",
              padding: "1rem",
            }}
          >
            <h2 style={{ margin: 0, color: "#fff5f5" }}>Delete Account</h2>
            <p style={{ margin: "0.7rem 0 0", color: "#f0c8c8" }}>
              Open the confirmation page to review the warning and complete the deletion flow.
            </p>
            <div style={{ marginTop: "0.9rem" }}>
              <Link
                href="/account/delete-confirm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "36px",
                  padding: "0 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(220, 98, 98, 0.42)",
                  background: "linear-gradient(180deg, rgba(161, 50, 50, 0.88), rgba(122, 29, 29, 0.92))",
                  color: "#fff5f5",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Open Delete Page
              </Link>
            </div>
          </article>
        </section>
      </UserProfile.Page>
    </UserProfile>
  );
}
