import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db as supabase } from "@/lib/cms-client";

export const Route = createFileRoute("/admin/performance")({
  head: () => ({ meta: [{ title: "Performance — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PerformancePage,
});

type PageView = {
  path: string;
  referrer: string | null;
  country: string | null;
  city: string | null;
  session_id: string | null;
  created_at: string;
};

function sourceOf(ref: string | null) {
  if (!ref) return "Direct";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (host.includes("google")) return "Google";
    if (host.includes("bing")) return "Bing";
    if (host.includes("duckduckgo")) return "DuckDuckGo";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("facebook") || host === "l.facebook.com") return "Facebook";
    if (host.includes("t.co") || host.includes("twitter") || host.includes("x.com")) return "Twitter/X";
    if (host.includes("pinterest")) return "Pinterest";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("whatsapp") || host === "wa.me") return "WhatsApp";
    return host;
  } catch {
    return "Other";
  }
}

function PerformancePage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: views = [] } = useQuery({
    queryKey: ["admin", "performance", "views"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("page_views")
        .select("path, referrer, country, city, session_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PageView[];
    },
    enabled: !!isAdmin,
  });

  const stats = useMemo(() => {
    const uniqueSessions = new Set(views.map((v) => v.session_id).filter(Boolean)).size;
    const sources = new Map<string, number>();
    const locations = new Map<string, number>();
    for (const v of views) {
      const s = sourceOf(v.referrer);
      sources.set(s, (sources.get(s) ?? 0) + 1);
      const loc = v.country ? (v.city ? `${v.city}, ${v.country}` : v.country) : "Unknown";
      locations.set(loc, (locations.get(loc) ?? 0) + 1);
    }
    const topSources = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topLocations = [...locations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { total: views.length, uniqueSessions, topSources, topLocations };
  }, [views]);

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-serif">Performance</h1>
            <p className="text-sm text-neutral-600 mt-1">Last 30 days · quick summary.</p>
          </div>
          <Link to="/admin/analytics" className="text-sm px-3 py-1.5 border rounded hover:bg-white">
            Full analytics →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Big label="Site visits" value={stats.total} sub={`${stats.uniqueSessions} unique visitors`} />
          <Big
            label="Top traffic source"
            value={stats.topSources[0]?.[0] ?? "—"}
            sub={stats.topSources[0] ? `${stats.topSources[0][1]} visits` : "no data yet"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <List title="Top traffic sources" rows={stats.topSources} />
          <List title="Top visit locations" rows={stats.topLocations} />
        </div>
      </div>
    </div>
  );
}

function Big({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="text-xs uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-4xl font-serif mt-2">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function List({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-sm font-medium mb-3">{title}</div>
      {rows.length === 0 && <div className="text-xs text-neutral-500">No data yet.</div>}
      <div className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="truncate pr-2">{k}</span>
              <span className="text-neutral-500">{v}</span>
            </div>
            <div className="h-1.5 bg-neutral-100 rounded overflow-hidden">
              <div className="h-full bg-black" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
