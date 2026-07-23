import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssets, type SiteAsset } from "@/lib/assets.functions";

export const Route = createFileRoute("/admin/assets")({
  head: () => ({ meta: [{ title: "Assets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAssetsPage,
});

function AdminAssetsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const list = useServerFn(listAllAssets);
  const [filter, setFilter] = useState<"all" | "images" | "videos" | "unused">("all");
  const [source, setSource] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["admin", "assets"],
    queryFn: () => list() as Promise<SiteAsset[]>,
    enabled: !!isAdmin,
    staleTime: 30_000,
  });

  const sources = useMemo(() => Array.from(new Set(assets.map((a) => a.source))).sort(), [assets]);

  const shown = useMemo(() => {
    return assets.filter((a) => {
      if (filter === "images" && a.kind !== "image") return false;
      if (filter === "videos" && a.kind !== "video") return false;
      if (filter === "unused" && a.usedOnSite) return false;
      if (source && a.source !== source) return false;
      if (search && !`${a.url} ${a.name ?? ""} ${a.alt ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assets, filter, source, search]);

  if (loading || !isAdmin) return null;

  const stats = {
    total: assets.length,
    images: assets.filter((a) => a.kind === "image").length,
    videos: assets.filter((a) => a.kind === "video").length,
    unused: assets.filter((a) => !a.usedOnSite).length,
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-serif">Assets library</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Every image, video and link ever uploaded or referenced on the site — even the ones not shown on any page.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Total" value={stats.total} />
          <Stat label="Images" value={stats.images} />
          <Stat label="Videos/links" value={stats.videos + assets.filter((a) => a.kind === "link").length} />
          <Stat label="Unused" value={stats.unused} highlight={stats.unused > 0} />
        </div>

        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center text-sm">
          <div className="flex gap-1">
            {(["all", "images", "videos", "unused"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs ${filter === f ? "bg-black text-white" : "border hover:bg-neutral-50"}`}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="Search url / name / alt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1 text-xs flex-1 min-w-[180px]"
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading assets…</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {shown.map((a, i) => (
              <a
                key={a.url + i}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="group bg-white border rounded overflow-hidden hover:shadow-md transition-shadow"
                title={a.url}
              >
                <div className="aspect-square bg-neutral-100 relative overflow-hidden">
                  {a.kind === "image" ? (
                    <img src={a.url} alt={a.alt ?? ""} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                      {a.kind === "video" ? "▶ VIDEO" : "🔗 LINK"}
                    </div>
                  )}
                  {!a.usedOnSite && (
                    <span className="absolute top-1 left-1 text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded">
                      unused
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[11px] text-neutral-500 truncate">{a.source}</div>
                  <div className="text-[11px] text-neutral-800 truncate">{a.name ?? a.url.split("/").pop()}</div>
                </div>
              </a>
            ))}
            {shown.length === 0 && (
              <div className="col-span-full text-sm text-neutral-500 text-center py-12">
                No assets match the filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${highlight ? "border-yellow-400" : ""}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-serif">{value}</div>
    </div>
  );
}
