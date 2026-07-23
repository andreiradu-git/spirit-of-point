import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssets, type SiteAsset } from "@/lib/assets.functions";
import { listAssetMeta, saveAssetMeta, generateAssetMeta, type AssetMeta } from "@/lib/asset-meta.functions";
import { replaceMediaObject } from "@/lib/media-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Zap, Undo2, ExternalLink } from "lucide-react";


export const Route = createFileRoute("/admin/assets")({
  head: () => ({ meta: [{ title: "Assets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAssetsPage,
});

function AdminAssetsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const list = useServerFn(listAllAssets);
  const listMeta = useServerFn(listAssetMeta);
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

  const { data: metas = [] } = useQuery({
    queryKey: ["admin", "asset-meta"],
    queryFn: () => listMeta() as Promise<AssetMeta[]>,
    enabled: !!isAdmin,
    staleTime: 30_000,
  });

  const metaMap = useMemo(() => {
    const m: Record<string, AssetMeta> = {};
    for (const r of metas) m[r.url] = r;
    return m;
  }, [metas]);

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
            Every image, video and link ever uploaded or referenced on the site. Edit label & alt text — or let AI write them.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((a, i) => (
              <AssetCard
                key={a.url + i}
                asset={a}
                meta={metaMap[a.url]}
              />
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

function AssetCard({ asset, meta }: { asset: SiteAsset; meta?: AssetMeta }) {
  const save = useServerFn(saveAssetMeta);
  const generate = useServerFn(generateAssetMeta);
  const qc = useQueryClient();
  const [label, setLabel] = useState(meta?.label ?? "");
  const [alt, setAlt] = useState(meta?.alt ?? asset.alt ?? "");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [optInfo, setOptInfo] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [dirty, setDirty] = useState(false);


  useEffect(() => {
    setLabel(meta?.label ?? "");
    setAlt(meta?.alt ?? asset.alt ?? "");
    setDirty(false);
  }, [meta, asset.alt]);

  const doSave = async () => {
    setSaving(true);
    try {
      await save({ data: { url: asset.url, label: label || null, alt: alt || null } });
      qc.invalidateQueries({ queryKey: ["admin", "asset-meta"] });
      qc.invalidateQueries({ queryKey: ["asset-meta"] });
      setDirty(false);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const doAi = async () => {
    setAiBusy(true);
    try {
      const out = await generate({
        data: { imageUrl: asset.url, context: asset.source, kind: asset.kind },
      });
      if (out.label) setLabel(out.label);
      if (out.alt) setAlt(out.alt);
      await save({
        data: { url: asset.url, label: out.label || null, alt: out.alt || null },
      });
      qc.invalidateQueries({ queryKey: ["admin", "asset-meta"] });
      qc.invalidateQueries({ queryKey: ["asset-meta"] });
      setDirty(false);
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  const backupPath = asset.storagePath ? `_originals/${asset.storagePath}` : null;

  const doOptimize = async (maxW = 1600, quality = 0.75) => {
    if (!asset.storagePath || !backupPath || asset.kind !== "image") return;
    setOptBusy(true);
    setOptInfo(null);
    try {
      const res = await fetch(asset.url, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const origBlob = await res.blob();
      const origSize = origBlob.size;
      const bmp = await createImageBitmap(origBlob);
      const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, w, h);
      const outBlob: Blob = await new Promise((r) =>
        canvas.toBlob((b) => r(b as Blob), "image/webp", quality),
      );
      if (outBlob.size >= origSize) {
        setOptInfo(`Already optimal (${Math.round(origSize / 1024)} KB)`);
        return;
      }
      // Save a one-time backup of the current file so Revert can restore it.
      await supabase.storage
        .from("media")
        .upload(backupPath, origBlob, { contentType: res.headers.get("content-type") || undefined, upsert: false, cacheControl: "3600" })
        .catch(() => { /* backup already exists — keep the first original */ });
      const { error } = await supabase.storage
        .from("media")
        .update(asset.storagePath, outBlob, { contentType: "image/webp", upsert: true, cacheControl: "3600" });
      if (error) throw error;
      setOptInfo(`${Math.round(origSize / 1024)} → ${Math.round(outBlob.size / 1024)} KB · ${w}×${h}`);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      alert("Optimize failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOptBusy(false);
    }
  };

  const doRevert = async () => {
    if (!asset.storagePath || !backupPath) return;
    setOptBusy(true);
    setOptInfo(null);
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from("media")
        .createSignedUrl(backupPath, 60);
      if (signErr || !signed) throw new Error("No backup found for this image.");
      const res = await fetch(signed.signedUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("Backup fetch failed");
      const blob = await res.blob();
      const ct = res.headers.get("content-type") || "application/octet-stream";
      const { error } = await supabase.storage
        .from("media")
        .update(asset.storagePath, blob, { contentType: ct, upsert: true, cacheControl: "3600" });
      if (error) throw error;
      setOptInfo(`Reverted (${Math.round(blob.size / 1024)} KB)`);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      alert("Revert failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOptBusy(false);
    }
  };

  const showFullSize = () => {
    window.open(asset.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-white border rounded overflow-hidden flex flex-col">
      <a href={asset.url} target="_blank" rel="noreferrer" className="block aspect-video bg-neutral-100 relative overflow-hidden" title={asset.url}>
        {asset.kind === "image" ? (
          <img
            src={asset.url}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
            {asset.kind === "video" ? "▶ VIDEO" : "🔗 LINK"}
          </div>
        )}
        {!asset.usedOnSite && (
          <span className="absolute top-1 left-1 text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded">unused</span>
        )}
        {asset.kind === "image" && naturalSize && (
          <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">
            {naturalSize.w}×{naturalSize.h}
          </span>
        )}
      </a>

      <div className="p-3 flex flex-col gap-2 text-xs">
        <div className="text-[11px] text-neutral-500 truncate">{asset.source}</div>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Label</span>
          <input
            value={label}
            onChange={(e) => { setLabel(e.target.value); setDirty(true); }}
            placeholder="Short title"
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Alt text</span>
          <textarea
            value={alt}
            onChange={(e) => { setAlt(e.target.value); setDirty(true); }}
            placeholder="Descriptive alt text for SEO & accessibility"
            rows={2}
            className="border rounded px-2 py-1 resize-y"
          />
        </label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={doAi}
            disabled={aiBusy || saving}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI write
          </button>
          <button
            type="button"
            onClick={doSave}
            disabled={saving || aiBusy || !dirty}
            className="flex-1 px-2 py-1.5 rounded border hover:bg-neutral-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {asset.kind === "image" && (
          <>
            <div className="flex gap-2 items-stretch">
              <button
                type="button"
                onClick={() => doOptimize()}
                disabled={optBusy || !asset.storagePath}
                title={
                  asset.storagePath
                    ? "Resize to max 1600px and re-encode as WebP, replacing the file in storage. Keeps a backup so you can Revert."
                    : "External image (not in Media library) — cannot be replaced. Re-upload it to the Media library to enable Optimize."
                }
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {optBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Optimize
              </button>
              <button
                type="button"
                onClick={doRevert}
                disabled={optBusy || !asset.storagePath}
                title={
                  asset.storagePath
                    ? "Restore this image from the backup saved before the last Optimize."
                    : "Revert only works for images stored in the Media library."
                }
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3 h-3" />
                Revert
              </button>
              <button
                type="button"
                onClick={showFullSize}
                title="Open the original file in a new tab (native resolution)."
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border hover:bg-neutral-50"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </button>
            </div>
            {optInfo && <div className="text-[10px] text-emerald-700 truncate">{optInfo}</div>}
          </>
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
