import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAdmin } from "@/hooks/use-admin";
import { getVitalsSummary, listVitalsRoutes } from "@/lib/analytics.functions";
import { METRIC_THRESHOLDS } from "@/lib/web-vitals-thresholds";

export const Route = createFileRoute("/admin/performance")({
  head: () => ({ meta: [{ title: "Performance — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PerformancePage,
});

type Device = "all" | "mobile" | "tablet" | "desktop";

function rate(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  const t = METRIC_THRESHOLDS[metric];
  if (!t) return "needs-improvement";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

function fmt(metric: string, value: number) {
  return METRIC_THRESHOLDS[metric]?.unit === "score" ? value.toFixed(3) : `${Math.round(value)} ms`;
}

function PerformancePage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const [days, setDays] = useState<7 | 30>(7);
  const [device, setDevice] = useState<Device>("all");
  const [path, setPath] = useState<string>("");
  const summary = useServerFn(getVitalsSummary);
  const routesFn = useServerFn(listVitalsRoutes);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "vitals", days, device, path],
    queryFn: () => summary({ data: { days, device, ...(path ? { path } : {}) } }),
    enabled: !!isAdmin,
    retry: false,
    staleTime: 30_000,
  });

  const { data: routes } = useQuery({
    queryKey: ["admin", "vitals", "routes"],
    queryFn: () => routesFn(),
    enabled: !!isAdmin,
    retry: false,
  });

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-serif">Performance</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Real-user Core Web Vitals measured in visitors' browsers.
            </p>
          </div>
          <Link to="/admin/analytics" className="text-sm px-3 py-1.5 border rounded bg-white hover:bg-neutral-100">
            Analytics →
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-6">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded border ${
                days === d ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-100"
              }`}
            >
              Last {d} days
            </button>
          ))}
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as Device)}
            className="text-xs border rounded px-2 py-1.5 bg-white"
          >
            <option value="all">All devices</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="desktop">Desktop</option>
          </select>
          <select
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="text-xs border rounded px-2 py-1.5 bg-white max-w-[260px]"
          >
            <option value="">Whole site</option>
            {(routes ?? []).map((r) => (
              <option key={r.path} value={r.path}>
                {r.path} ({r.samples})
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-neutral-100"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {isPending && <Notice tone="info">Loading performance data…</Notice>}
        {error && (
          <Notice tone="error">
            Performance data could not be loaded: {error instanceof Error ? error.message : String(error)}
          </Notice>
        )}
        {data && data.totalSamples === 0 && (
          <Notice tone="info">
            Performance data will appear after enough production visits have been measured.
          </Notice>
        )}

        {data && data.totalSamples > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {["LCP", "INP", "CLS"].map((metric) => (
                <MetricCard key={metric} metric={metric} data={data} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["FCP", "TTFB"].map((metric) => (
                <MetricCard key={metric} metric={metric} data={data} />
              ))}
            </div>

            <div className="bg-white border rounded-lg p-5 mt-6">
              <div className="text-sm font-medium mb-3">Per-page p75 (min. 3 samples)</div>
              {data.routes.length === 0 ? (
                <div className="text-xs text-neutral-500">Not enough per-page samples yet.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-neutral-500">
                    <tr>
                      <th className="py-1">Page</th>
                      <th className="py-1">Metric</th>
                      <th className="py-1">p75</th>
                      <th className="py-1">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.routes.map((r) => (
                      <tr key={`${r.path}-${r.metric}`} className="border-t">
                        <td className="py-1 pr-2 truncate max-w-[240px]">{r.path}</td>
                        <td className="py-1 pr-2">{r.metric}</td>
                        <td className="py-1 pr-2">{fmt(r.metric, r.p75)}</td>
                        <td className="py-1 text-neutral-500">{r.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-xs text-neutral-500 mt-6">
              Field measurements from real visits ({data.totalSamples} samples in range). No
              personal identifiers are stored — only route, metric, value and device category.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  metric,
  data,
}: {
  metric: string;
  data: { metrics: Array<{ metric: string; samples: number; p75: number | null; median: number | null }> };
}) {
  const row = data.metrics.find((m) => m.metric === metric);
  const threshold = METRIC_THRESHOLDS[metric];
  if (!row || row.samples === 0 || row.p75 === null) {
    return (
      <div className="bg-white border rounded-lg p-5">
        <div className="text-xs uppercase tracking-widest text-neutral-500">{metric}</div>
        <div className="text-lg mt-2 text-neutral-500">Insufficient data</div>
        <div className="text-[11px] text-neutral-400 mt-1">
          Good ≤ {threshold?.unit === "score" ? threshold.good : `${threshold?.good} ms`}
        </div>
      </div>
    );
  }
  const rating = rate(metric, row.p75);
  const tone =
    rating === "good"
      ? "text-green-700 border-green-300 bg-green-50"
      : rating === "needs-improvement"
        ? "text-amber-700 border-amber-300 bg-amber-50"
        : "text-red-700 border-red-300 bg-red-50";
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-xs uppercase tracking-widest text-neutral-500">{metric}</div>
      <div className="text-3xl font-serif mt-1">{fmt(metric, row.p75)}</div>
      <div className={`inline-block text-[11px] px-2 py-0.5 rounded border mt-2 ${tone}`}>
        {rating === "good" ? "Good" : rating === "needs-improvement" ? "Needs improvement" : "Poor"}
      </div>
      <div className="text-[11px] text-neutral-500 mt-2">
        p75 · median {row.median !== null ? fmt(metric, row.median) : "—"} · {row.samples} samples
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm mb-6 ${
        tone === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-neutral-300 bg-white text-neutral-700"
      }`}
    >
      {children}
    </div>
  );
}
