import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { db } from "@/lib/cms-client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnalyticsPage,
});

type View = {
  id: string;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  session_id: string | null;
  country: string | null;
  city: string | null;
  search_query: string | null;
  created_at: string;
};

type Tab = "traffic" | "engagement";

function AdminAnalyticsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [tab, setTab] = useState<Tab>("traffic");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: views } = useQuery({
    queryKey: ["page_views", range],
    queryFn: async () => {
      const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("page_views")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as View[];
    },
    enabled: !!isAdmin,
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    if (!views) return null;
    const total = views.length;
    const sessions = new Set(views.map((v) => v.session_id).filter(Boolean)).size;
    const byPath = new Map<string, number>();
    const byReferrer = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byCity = new Map<string, number>();
    const bySearch = new Map<string, number>();
    const bySiteSearch = new Map<string, number>();
    const engagementByPath = new Map<string, { views: number; sessions: Set<string> }>();

    for (const v of views) {
      byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);

      // Search engine keywords from referrer (?q=, ?p=, ?query=)
      let refLabel = "Direct";
      if (v.referrer) {
        try {
          const u = new URL(v.referrer);
          refLabel = u.hostname;
          const q =
            u.searchParams.get("q") ||
            u.searchParams.get("p") ||
            u.searchParams.get("query") ||
            u.searchParams.get("search_query");
          if (q) bySearch.set(q.toLowerCase(), (bySearch.get(q.toLowerCase()) ?? 0) + 1);
        } catch {}
      }
      byReferrer.set(refLabel, (byReferrer.get(refLabel) ?? 0) + 1);

      const day = v.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);

      if (v.country) byCountry.set(v.country, (byCountry.get(v.country) ?? 0) + 1);
      if (v.city) byCity.set(v.city, (byCity.get(v.city) ?? 0) + 1);

      if (v.search_query) {
        const q = v.search_query.toLowerCase();
        bySiteSearch.set(q, (bySiteSearch.get(q) ?? 0) + 1);
      }

      const eb = engagementByPath.get(v.path) ?? { views: 0, sessions: new Set<string>() };
      eb.views += 1;
      if (v.session_id) eb.sessions.add(v.session_id);
      engagementByPath.set(v.path, eb);
    }

    const topPaths = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topRefs = [...byReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topSearch = [...bySearch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const topCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topCities = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topSiteSearch = [...bySiteSearch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const days = [...byDay.entries()].sort();
    const engagement = total && sessions ? (total / sessions).toFixed(1) : "0";
    const siteContent = [...engagementByPath.entries()]
      .map(([path, e]) => ({
        path,
        views: e.views,
        sessions: e.sessions.size,
        avg: e.sessions.size ? (e.views / e.sessions.size).toFixed(1) : "0",
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);
    const activity = views.slice(0, 30);

    return {
      total,
      sessions,
      topPaths,
      topRefs,
      topSearch,
      topCountries,
      topCities,
      topSiteSearch,
      days,
      engagement,
      siteContent,
      activity,
    };
  }, [views]);

  if (loading || !isAdmin) return null;
  const max = stats ? Math.max(1, ...stats.days.map(([, n]) => n)) : 1;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-serif">Site Analytics</h1>
            <p className="text-sm text-neutral-600 mt-1">Traffic, sources, geography and engagement on your site.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
              className="border rounded px-2 py-1"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Link to="/admin/seo" className="px-3 py-1.5 border rounded hover:bg-white">← SEO</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {(["traffic", "engagement"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
                tab === t ? "border-black font-medium" : "border-transparent text-neutral-500 hover:text-black"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {!stats ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : tab === "traffic" ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Metric label="Pageviews" value={stats.total} />
              <Metric label="Unique sessions" value={stats.sessions} />
              <Metric label="Pages / session" value={stats.engagement} />
              <Metric label="Top country" value={stats.topCountries[0]?.[0] ?? "—"} small />
            </div>

            <div className="bg-white border rounded-lg p-5 mb-6">
              <div className="text-sm font-medium mb-3">Traffic over time</div>
              <div className="flex items-end gap-1 h-32">
                {stats.days.map(([d, n]) => (
                  <div key={d} className="flex-1 flex flex-col items-center justify-end group">
                    <div
                      className="w-full bg-black/80 rounded-t group-hover:bg-black"
                      style={{ height: `${(n / max) * 100}%` }}
                      title={`${d}: ${n}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                <span>{stats.days[0]?.[0]}</span>
                <span>{stats.days[stats.days.length - 1]?.[0]}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Panel title="Traffic sources">
                {stats.topRefs.length === 0 ? (
                  <Empty>No data yet.</Empty>
                ) : (
                  stats.topRefs.map(([r, n]) => (
                    <Row key={r} label={r} value={n} max={stats.topRefs[0][1]} />
                  ))
                )}
              </Panel>
              <Panel title="Search keywords (from referrers)">
                {stats.topSearch.length === 0 ? (
                  <Empty>No search-engine keywords captured yet. Most engines strip these — install Google Search Console for full coverage.</Empty>
                ) : (
                  stats.topSearch.map(([k, n]) => (
                    <Row key={k} label={k} value={n} max={stats.topSearch[0][1]} />
                  ))
                )}
              </Panel>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Geography — countries">
                {stats.topCountries.length === 0 ? (
                  <Empty>Waiting on visits with location data…</Empty>
                ) : (
                  stats.topCountries.map(([c, n]) => (
                    <Row key={c} label={c} value={n} max={stats.topCountries[0][1]} />
                  ))
                )}
              </Panel>
              <Panel title="Geography — cities">
                {stats.topCities.length === 0 ? (
                  <Empty>Waiting on visits with location data…</Empty>
                ) : (
                  stats.topCities.map(([c, n]) => (
                    <Row key={c} label={c} value={n} max={stats.topCities[0][1]} />
                  ))
                )}
              </Panel>
            </div>
          </>
        ) : (
          <>
            <Panel title="Site content — engagement per page">
              <div className="grid grid-cols-4 text-[11px] uppercase tracking-wider text-neutral-500 pb-2 border-b mb-2">
                <div>Page</div>
                <div className="text-right">Views</div>
                <div className="text-right">Sessions</div>
                <div className="text-right">Views / session</div>
              </div>
              {stats.siteContent.length === 0 ? (
                <Empty>No page activity yet.</Empty>
              ) : (
                stats.siteContent.map((r) => (
                  <div key={r.path} className="grid grid-cols-4 text-xs py-1.5 border-b border-neutral-50">
                    <div className="truncate">{r.path}</div>
                    <div className="text-right">{r.views}</div>
                    <div className="text-right">{r.sessions}</div>
                    <div className="text-right text-neutral-500">{r.avg}</div>
                  </div>
                ))
              )}
            </Panel>

            <div className="mt-4">
              <Panel title="Activity log — recent visits">
                {stats.activity.length === 0 ? (
                  <Empty>No recent activity.</Empty>
                ) : (
                  <div className="space-y-1">
                    {stats.activity.map((v) => (
                      <div key={v.id} className="text-xs flex justify-between gap-3 py-1 border-b border-neutral-50">
                        <span className="text-neutral-500 shrink-0 w-36">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                        <span className="truncate flex-1 font-mono">{v.path}</span>
                        <span className="text-neutral-500 truncate w-40 text-right">
                          {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="mt-4">
              <Panel title="Site search keywords (?q= on your URLs)">
                {stats.topSiteSearch.length === 0 ? (
                  <Empty>
                    No on-site searches recorded. If you add an internal search that navigates to <code>?q=…</code>, terms will appear here.
                  </Empty>
                ) : (
                  stats.topSiteSearch.map(([k, n]) => (
                    <Row key={k} label={k} value={n} max={stats.topSiteSearch[0][1]} />
                  ))
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={small ? "text-lg font-medium mt-1 truncate" : "text-3xl font-serif mt-1"}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-sm font-medium mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="truncate mr-2">{label}</span>
        <span className="text-neutral-500">{value}</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded overflow-hidden">
        <div className="h-full bg-black/70" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-neutral-500 py-2">{children}</div>;
}
