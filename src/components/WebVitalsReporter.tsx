// Real-user Core Web Vitals collection.
// Loads the web-vitals library after hydration, buffers the metrics of the
// current page and flushes them once (on page hide) so D1 writes stay minimal.
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

type Sample = { metric: string; value: number; rating?: "good" | "needs-improvement" | "poor" };

export function WebVitalsReporter() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path.startsWith("/admin") || path.startsWith("/auth")) return;

    let cancelled = false;
    const buffer = new Map<string, Sample>();
    const startPath = path;

    const flush = () => {
      if (buffer.size === 0) return;
      const payload = JSON.stringify({
        path: startPath,
        lang: startPath === "/ro" || startPath.startsWith("/ro/") ? "ro" : "en",
        metrics: [...buffer.values()],
      });
      buffer.clear();
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/public/vitals", new Blob([payload], { type: "application/json" }));
          return;
        }
      } catch {
        /* fall through to fetch */
      }
      void fetch("/api/public/vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };

    void import("web-vitals").then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      if (cancelled) return;
      const record = (m: { name: string; value: number; rating: Sample["rating"] }) => {
        buffer.set(m.name, { metric: m.name, value: m.value, rating: m.rating });
      };
      onLCP(record);
      onINP(record);
      onCLS(record);
      onFCP(record);
      onTTFB(record);
    });

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [path]);

  return null;
}
