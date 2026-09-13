"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function HeaderAccountActions() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <>
      <Link href="/customer-portal" prefetch={false} className="nav-pill nav-games">Portal</Link>
      {!isLoaded ? null : isSignedIn ? (
        <Link href="/account" prefetch={false} className="nav-pill nav-install">Account</Link>
      ) : (
        <Link href="/sign-in" className="nav-pill nav-install">Sign In</Link>
      )}
    </>
  );
}
