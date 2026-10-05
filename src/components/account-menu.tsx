"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./account-menu.module.css";

type AccountMenuProps = {
  avatarUrl?: string | null;
  label: string;
};

export default function AccountMenu({ avatarUrl, label }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fallback = label.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className={styles.menuRoot} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        onClick={() => setOpen((value) => !value)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={label} className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback}>{fallback}</span>
        )}
      </button>

      {open ? (
        <div className={styles.panel} role="menu">
          <Link href="/account" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Account
          </Link>
          <Link href="/support" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            Support tickets
          </Link>
          <SignOutButton>
            <button type="button" className={styles.item} role="menuitem">
              Sign out
            </button>
          </SignOutButton>
        </div>
      ) : null}
    </div>
  );
}
