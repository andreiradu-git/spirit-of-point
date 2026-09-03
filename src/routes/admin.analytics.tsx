import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAdmin } from "@/hooks/use-admin";
import { getAnalyticsSummary } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const summary = useServerFn(getAnalyticsSummary);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: () => summary({ data: { days: range } }),
    enabled: !!isAdmin,
    staleTime: 30_000,
    retry: false,
  });

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-serif">Analytics</h1>
            <p className="text-sm text-neutral-600 mt-1">
              First-party, cookie-free measurement stored in Cloudflare D1.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`text-xs px-3 py-1.5 rounded border ${
                  range === d ? "bg-black text-white border-black" : "bg-white hover:bg-neutral-100"
                }`}
              >
                {d} days
              </button>
            ))}
            <button
              onClick={() => refetch()}
              className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-neutral-100"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <Link to="/admin/performance" className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-neutral-100">
              Performance →
            </Link>
          </div>
        </div>

        {isPending && <Notice tone="info">Loading analytics…</Notice>}

        {error && (
          <Notice tone="error">
            Analytics could not be loaded: {error instanceof Error ? error.message : String(error)}
          </Notice>
        )}

        {data && data.totalAllTime === 0 && (
          <Notice tone="info">No analytics data has been collected yet.</Notice>
        )}

        {data && data.totalAllTime > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Stat label="All time views" value={data.totalAllTime} />
              <Stat label="Today" value={data.today} />
              <Stat label="Last 7 days" value={data.last7} />
              <Stat label="Last 30 days" value={data.last30} />
              <Stat label={`Unique sessions (${range}d)`} value={data.rangeSessions} />
            </div>

            <Card title={`Traffic over time (${range} days)`}>
              {data.daily.length === 0 ? (
                <Empty>No visits in this range.</Empty>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {data.daily.map((d) => {
                    const max = Math.max(...data.daily.map((x) => x.views), 1);
                    return (
                      <div key={d.day} className="flex-1 group relative">
                        <div
                          className="bg-black/80 rounded-t"
                          style={{ height: `${(d.views / max) * 100}%`, minHeight: 2 }}
                          title={`${d.day}: ${d.views} views · ${d.sessions} sessions`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between text-[11px] text-neutral-500 mt-2">
                <span>{data.daily[0]?.day}</span>
                <span>{data.daily[data.daily.length - 1]?.day}</span>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card title="Most viewed pages">
                <Bars rows={data.topPaths.map((p) => [p.path, p.views])} />
              </Card>
              <Card title="Language split (EN / RO)">
                <Bars rows={data.langSplit.map((l) => [l.lang.toUpperCase(), l.views])} />
              </Card>
              <Card title="Traffic sources">
                <Bars rows={data.referrers.map((r) => [r.source, r.views])} />
              </Card>
              <Card title="Devices">
                <Bars rows={data.devices.map((d) => [d.device, d.views])} />
              </Card>
              <Card title="Countries">
                <Bars rows={data.countries.map((c) => [c.country, c.views])} />
              </Card>
            </div>

            <p className="text-xs text-neutral-500 mt-6">
              Privacy: no cookies, no IP addresses, no user-agent strings and no cross-site
              identifiers are stored. Sessions are a random per-tab identifier held in
              sessionStorage only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-2xl font-serif mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-neutral-500">{children}</div>;
}

function Bars({ rows }: { rows: Array<[string, number]> }) {
  if (rows.length === 0) return <Empty>No data in this range.</Empty>;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="truncate pr-2">{label}</span>
            <span className="text-neutral-500">{value}</span>
          </div>
          <div className="h-1.5 bg-neutral-100 rounded overflow-hidden">
            <div className="h-full bg-black" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
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
