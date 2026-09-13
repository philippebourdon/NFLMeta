"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const ANONYMOUS_ID_KEY = "nflmeta_analytics_id";
const SESSION_ID_KEY = "nflmeta_analytics_session_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function storedId(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = randomId();
  storage.setItem(key, next);
  return next;
}

export default function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api/")) return;
    if (process.env.NEXT_PUBLIC_SITE_ANALYTICS_DISABLED === "true") return;

    const query = searchParams.toString();
    const key = `${pathname}?${query}`;
    if (lastSent.current === key) return;
    lastSent.current = key;

    let anonymousId: string | null = null;
    let sessionId: string | null = null;
    try {
      anonymousId = storedId(window.localStorage, ANONYMOUS_ID_KEY);
      sessionId = storedId(window.sessionStorage, SESSION_ID_KEY);
    } catch {
      anonymousId = null;
      sessionId = null;
    }

    const payload = {
      path: pathname,
      query,
      referrer: document.referrer || null,
      anonymousId,
      sessionId,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language || null,
    };

    void fetch("/api/site-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}
