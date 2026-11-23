"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalMs?: number;
};

/**
 * Drop into a server-rendered page to keep it live without a full reload.
 * router.refresh() re-runs the page's server component (so it re-reads
 * the database) and streams fresh props down to its children - cheaper
 * than a page reload, no client-side data-fetching/state duplication
 * needed on the page itself.
 *
 * Pauses while the tab is in the background so an unattended/minimized
 * tab doesn't keep polling the server for nothing.
 */
export function AutoRefresh({ intervalMs = 5000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function handleVisibility() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
