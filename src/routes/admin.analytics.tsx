import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
};

function AdminAnalyticsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: views } = useQuery({
    queryKey: ["page_views", range],
    queryFn: async () => {
      const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("page_views")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
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
    for (const v of views) {
      byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
      const ref = v.referrer ? new URL(v.referrer).hostname : "Direct";
      byReferrer.set(ref, (byReferrer.get(ref) ?? 0) + 1);
      const day = v.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const topPaths = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topRefs = [...byReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const days = [...byDay.entries()].sort();
    const engagement = total && sessions ? (total / sessions).toFixed(1) : "0";
    return { total, sessions, topPaths, topRefs, days, engagement };
  }, [views]);

  if (loading || !isAdmin) return null;

  const max = stats ? Math.max(1, ...stats.days.map(([, n]) => n)) : 1;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif">Site Analytics</h1>
            <p className="text-sm text-neutral-600 mt-1">Traffic, sessions and engagement on your site.</p>
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

        {!stats ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <Metric label="Pageviews" value={stats.total} />
              <Metric label="Unique sessions" value={stats.sessions} />
              <Metric label="Pages / session" value={stats.engagement} />
              <Metric label="Top page" value={stats.topPaths[0]?.[0] ?? "—"} small />
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

            <div className="grid md:grid-cols-2 gap-4">
              <Panel title="Top pages">
                {stats.topPaths.map(([p, n]) => (
                  <Row key={p} label={p} value={n} max={stats.topPaths[0][1]} />
                ))}
              </Panel>
              <Panel title="Traffic sources">
                {stats.topRefs.map(([r, n]) => (
                  <Row key={r} label={r} value={n} max={stats.topRefs[0][1]} />
                ))}
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
