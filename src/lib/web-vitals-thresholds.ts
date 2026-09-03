// Standard Core Web Vitals thresholds (web.dev), shared by admin UI and server.
export const METRIC_THRESHOLDS: Record<string, { good: number; poor: number; unit: "ms" | "score" }> = {
  LCP: { good: 2500, poor: 4000, unit: "ms" },
  INP: { good: 200, poor: 500, unit: "ms" },
  CLS: { good: 0.1, poor: 0.25, unit: "score" },
  FCP: { good: 1800, poor: 3000, unit: "ms" },
  TTFB: { good: 800, poor: 1800, unit: "ms" },
};
