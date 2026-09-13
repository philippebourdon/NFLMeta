"use client";

import { SignOutButton } from "@clerk/nextjs";

export default function SignOutCardButton() {
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className="account-sign-out-button">
        Sign Out
      </button>
    </SignOutButton>
  );
}
