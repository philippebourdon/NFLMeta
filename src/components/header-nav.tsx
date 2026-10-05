"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HeaderNavGroup = {
  label: string;
  href: string;
  className: string;
  items: Array<{
    href: string;
    label: string;
    description?: string;
    tone?: "default" | "primary" | "success" | "support";
  }>;
};

type HeaderNavProps = {
  groups: HeaderNavGroup[];
};

export default function HeaderNav({ groups }: HeaderNavProps) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenLabel(null);
        setMobileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenLabel(null);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function openMenu(label: string) {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenLabel(label);
  }

  function scheduleClose(label: string) {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setOpenLabel((current) => (current === label ? null : current));
      closeTimeoutRef.current = null;
    }, 160);
  }

  return (
    <div className={`nav-shell${mobileOpen ? " is-mobile-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`nav-mobile-toggle${mobileOpen ? " is-open" : ""}`}
        aria-expanded={mobileOpen}
        aria-controls="primary-nav"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        onClick={() => {
          setMobileOpen((current) => {
            const next = !current;
            if (!next) setOpenLabel(null);
            return next;
          });
        }}
      >
        <span className="nav-mobile-toggle-label">Menu</span>
        <span className="nav-mobile-toggle-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <nav id="primary-nav" className={`nav${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Primary navigation">
        {groups.map((group) => {
          const isOpen = openLabel === group.label;

          if (group.items.length === 0) {
            return (
              <div key={group.label} className="nav-menu">
                <div className="nav-split">
                  <Link href={group.href} className="nav-pill-link" onClick={() => {
                    setOpenLabel(null);
                    setMobileOpen(false);
                  }}>{group.label}</Link>
                </div>
              </div>
            );
          }

          return (
            <div
              key={group.label}
              className={`nav-menu${isOpen ? " is-open" : ""}`}
              onMouseEnter={() => openMenu(group.label)}
              onMouseLeave={() => scheduleClose(group.label)}
            >
              <div className={`nav-split${isOpen ? " is-open" : ""}`}>
                <Link
                  href={group.href}
                  className="nav-pill-link"
                  onClick={() => {
                    setOpenLabel(null);
                    setMobileOpen(false);
                  }}
                >
                  {group.label}
                </Link>
                <button
                  type="button"
                  className="nav-pill-toggle"
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  aria-label={`Toggle ${group.label} menu`}
                  onClick={() => setOpenLabel((current) => (current === group.label ? null : group.label))}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="nav-pill-caret">
                    <path
                      d="M3.25 5.5 8 10.25l4.75-4.75"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="nav-dropdown" role="menu" aria-label={`${group.label} links`}>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-dropdown-link${item.tone && item.tone !== "default" ? ` is-${item.tone}` : ""}`}
                    role="menuitem"
                    onClick={() => {
                      setOpenLabel(null);
                      setMobileOpen(false);
                    }}
                  >
                    <span className="nav-dropdown-label">{item.label}</span>
                    {item.description ? (
                      <span className="nav-dropdown-description">{item.description}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
