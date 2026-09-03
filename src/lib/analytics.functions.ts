// Admin-only analytics and Web Vitals aggregation.
// Every aggregate is computed in SQL inside Cloudflare D1 — the browser never
// receives raw event rows, and every function is gated by an administrator session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/admin-auth";
import { d1All, d1First } from "@/lib/d1.server";
import { METRIC_THRESHOLDS } from "@/lib/web-vitals-thresholds";

const rangeSchema = z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) });

function sinceIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type AnalyticsSummary = {
  scannedAt: string;
  days: number;
  totalAllTime: number;
  today: number;
  last7: number;
  last30: number;
  rangeViews: number;
  rangeSessions: number;
  daily: Array<{ day: string; views: number; sessions: number }>;
  topPaths: Array<{ path: string; views: number; sessions: number }>;
  langSplit: Array<{ lang: string; views: number }>;
  devices: Array<{ device: string; views: number }>;
  referrers: Array<{ source: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
};

export const getAnalyticsSummary = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => rangeSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<AnalyticsSummary> => {
    const since = sinceIso(data.days);
    const startOfDay = new Date().toISOString().slice(0, 10);

    const [totals, daily, topPaths, langSplit, devices, referrers, countries] = await Promise.all([
      d1First<{ total: number; today: number; last7: number; last30: number; range_views: number; range_sessions: number }>(
        `SELECT
           (SELECT COUNT(*) FROM page_views) AS total,
           (SELECT COUNT(*) FROM page_views WHERE created_at >= ?) AS today,
           (SELECT COUNT(*) FROM page_views WHERE created_at >= ?) AS last7,
           (SELECT COUNT(*) FROM page_views WHERE created_at >= ?) AS last30,
           (SELECT COUNT(*) FROM page_views WHERE created_at >= ?) AS range_views,
           (SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at >= ? AND session_id IS NOT NULL) AS range_sessions`,
        [startOfDay, sinceIso(7), sinceIso(30), since, since],
      ),
      d1All<{ day: string; views: number; sessions: number }>(
        `SELECT substr(created_at,1,10) AS day, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
         FROM page_views WHERE created_at >= ? GROUP BY day ORDER BY day ASC`,
        [since],
      ),
      d1All<{ path: string; views: number; sessions: number }>(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT session_id) AS sessions
         FROM page_views WHERE created_at >= ? GROUP BY path ORDER BY views DESC LIMIT 20`,
        [since],
      ),
      d1All<{ lang: string; views: number }>(
        `SELECT COALESCE(lang, CASE WHEN path = '/ro' OR path LIKE '/ro/%' THEN 'ro' ELSE 'en' END) AS lang,
                COUNT(*) AS views
         FROM page_views WHERE created_at >= ? GROUP BY lang ORDER BY views DESC`,
        [since],
      ),
      d1All<{ device: string; views: number }>(
        `SELECT COALESCE(device,'unknown') AS device, COUNT(*) AS views
         FROM page_views WHERE created_at >= ? GROUP BY device ORDER BY views DESC`,
        [since],
      ),
      d1All<{ referrer: string | null; views: number }>(
        `SELECT referrer, COUNT(*) AS views FROM page_views WHERE created_at >= ?
         GROUP BY referrer ORDER BY views DESC LIMIT 200`,
        [since],
      ),
      d1All<{ country: string; views: number }>(
        `SELECT COALESCE(country,'Unknown') AS country, COUNT(*) AS views
         FROM page_views WHERE created_at >= ? GROUP BY country ORDER BY views DESC LIMIT 15`,
        [since],
      ),
    ]);

    // Collapse referrer URLs into hostnames server-side.
    const bySource = new Map<string, number>();
    for (const row of referrers) {
      let label = "Direct";
      if (row.referrer) {
        try {
          label = new URL(row.referrer).hostname.replace(/^www\./, "");
        } catch {
          label = "Other";
        }
      }
      bySource.set(label, (bySource.get(label) ?? 0) + row.views);
    }

    return {
      scannedAt: new Date().toISOString(),
      days: data.days,
      totalAllTime: totals?.total ?? 0,
      today: totals?.today ?? 0,
      last7: totals?.last7 ?? 0,
      last30: totals?.last30 ?? 0,
      rangeViews: totals?.range_views ?? 0,
      rangeSessions: totals?.range_sessions ?? 0,
      daily,
      topPaths,
      langSplit,
      devices,
      referrers: [...bySource.entries()]
        .map(([source, views]) => ({ source, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 12),
      countries,
    };
  });



export type VitalsSummary = {
  scannedAt: string;
  days: number;
  totalSamples: number;
  metrics: Array<{ metric: string; samples: number; p75: number | null; median: number | null }>;
  routes: Array<{ path: string; metric: string; samples: number; p75: number }>;
};

const vitalsSchema = z.object({
  days: z.union([z.literal(7), z.literal(30)]).default(7),
  device: z.enum(["all", "mobile", "tablet", "desktop"]).default("all"),
  path: z.string().max(300).optional(),
});

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

export const getVitalsSummary = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .inputValidator((input) => vitalsSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<VitalsSummary> => {
    const params: Array<string | number> = [sinceIso(data.days)];
    let where = "created_at >= ?";
    if (data.device !== "all") {
      where += " AND device = ?";
      params.push(data.device);
    }
    if (data.path) {
      where += " AND path = ?";
      params.push(data.path);
    }

    const rows = await d1All<{ metric: string; value: number; path: string }>(
      `SELECT metric, value, path FROM web_vitals WHERE ${where} LIMIT 20000`,
      params,
    );

    const byMetric = new Map<string, number[]>();
    const byRoute = new Map<string, number[]>();
    for (const row of rows) {
      const list = byMetric.get(row.metric) ?? [];
      list.push(row.value);
      byMetric.set(row.metric, list);
      const key = `${row.path}\u0000${row.metric}`;
      const rl = byRoute.get(key) ?? [];
      rl.push(row.value);
      byRoute.set(key, rl);
    }

    return {
      scannedAt: new Date().toISOString(),
      days: data.days,
      totalSamples: rows.length,
      metrics: Object.keys(METRIC_THRESHOLDS).map((metric) => {
        const values = byMetric.get(metric) ?? [];
        return {
          metric,
          samples: values.length,
          p75: percentile(values, 75),
          median: percentile(values, 50),
        };
      }),
      routes: [...byRoute.entries()]
        .map(([key, values]) => {
          const [path, metric] = key.split("\u0000");
          return { path, metric, samples: values.length, p75: percentile(values, 75) ?? 0 };
        })
        .filter((r) => r.samples >= 3)
        .sort((a, b) => b.samples - a.samples)
        .slice(0, 40),
    };
  });

export const listVitalsRoutes = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () =>
    d1All<{ path: string; samples: number }>(
      `SELECT path, COUNT(*) AS samples FROM web_vitals GROUP BY path ORDER BY samples DESC LIMIT 50`,
    ),
  );
