"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the server-rendered game data without publishing a free JSON feed. */
export default function GameLiveRefresh({ intervalMs }: { intervalMs: number | null }) {
  const router = useRouter();

  useEffect(() => {
    if (intervalMs == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (cancelled) return;
      router.refresh();
      timer = setTimeout(refresh, document.hidden ? Math.max(intervalMs, 15_000) : intervalMs);
    };
    timer = setTimeout(refresh, intervalMs);
    const onVisibility = () => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return null;
}
