import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssets, type SiteAsset } from "@/lib/assets.functions";
import {
  listAssetMeta,
  saveAssetMeta,
  generateAssetMeta,
  type AssetMeta,
} from "@/lib/asset-meta.functions";
import {
  uploadToR2,
  deleteR2Object,
  migrateSupabaseToR2,
  replaceR2Object,
  renameR2Object,
  readR2Object,
  writeR2Variants,
} from "@/lib/r2.functions";
import {
  optimizeImageBlob,
  blobToBase64 as optBlobToBase64,
  withExt,
} from "@/lib/optimize-image";

import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Loader2,
  Zap,
  Undo2,
  ExternalLink,
  Trash2,
  Cloud,
  Copy,
  Check,
  Pencil,
  UploadCloud,
} from "lucide-react";

export const Route = createFileRoute("/admin/assets")({
  head: () => ({ meta: [{ title: "Assets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAssetsPage,
});

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function collectSettingUrls(value: unknown, key: string, out: SiteAsset[]) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) {
      out.push({
        kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(value) ? "video" : "image",
        url: value,
        source: `Setting: ${key}`,
        usedOnSite: true,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSettingUrls(item, key, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  const url = typeof obj.src === "string" ? obj.src : typeof obj.url === "string" ? obj.url : null;
  const alt = typeof obj.alt === "string" ? obj.alt : null;
  if (url && /^https?:\/\//.test(url)) {
    out.push({
      kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || key.toLowerCase().includes("video") ? "video" : "image",
      url,
      source: `Setting: ${key}`,
      alt,
      usedOnSite: true,
    });
  }
  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") collectSettingUrls(nested, key, out);
  }
}

async function mergeAssets(r2Assets: SiteAsset[]): Promise<SiteAsset[]> {
  const referenced: SiteAsset[] = [];
  const usedUrls = new Set<string>();
  try {
    const { data: galleries } = await supabase
      .from("galleries")
      .select("slug, gallery_images(src, alt)");
    for (const gallery of galleries ?? []) {
      for (const image of (gallery.gallery_images ?? []) as Array<{ src: string; alt: string | null }>) {
        usedUrls.add(image.src);
        referenced.push({
          kind: "image",
          url: image.src,
          source: `Gallery: ${gallery.slug}`,
          alt: image.alt,
          usedOnSite: true,
        });
      }
    }
    const { data: settings } = await supabase.from("site_settings").select("key, value");
    for (const row of settings ?? []) collectSettingUrls(row.value, row.key, referenced);
    for (const asset of referenced) usedUrls.add(asset.url);
  } catch (e) {
    console.warn("Site asset references unavailable; showing R2 library only", e);
  }
  const merged = r2Assets.map((asset) => ({ ...asset, usedOnSite: usedUrls.has(asset.url) || asset.usedOnSite }));
  const seen = new Set(merged.map((asset) => asset.url));
  for (const asset of referenced) {
    if (!seen.has(asset.url)) {
      merged.push(asset);
      seen.add(asset.url);
    }
  }
  return merged;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function humanSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function humanDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "";
  }
}

// -----------------------------------------------------------------------------
// page
// -----------------------------------------------------------------------------

type Filter = "all" | "images" | "videos" | "files" | "unused";
type SortKey = "date-desc" | "date-asc" | "size-desc" | "size-asc" | "name-asc";

function AdminAssetsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const list = useServerFn(listAllAssets);
  const listMeta = useServerFn(listAssetMeta);
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [source, setSource] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: assets = [], isLoading } = useQuery<SiteAsset[]>({
    queryKey: ["admin", "assets"],
    queryFn: async () => mergeAssets(await list() as SiteAsset[]),
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
    const q = search.trim().toLowerCase();
    const filtered = assets.filter((a) => {
      if (filter === "images" && a.kind !== "image") return false;
      if (filter === "videos" && a.kind !== "video") return false;
      if (filter === "files" && a.kind !== "file" && a.kind !== "link") return false;
      if (filter === "unused" && a.usedOnSite) return false;
      if (source && a.source !== source) return false;
      if (q) {
        const m = metaMap[a.url];
        const hay = `${a.url} ${a.name ?? ""} ${a.alt ?? ""} ${m?.label ?? ""} ${m?.caption ?? ""} ${m?.description ?? ""} ${(m?.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "date-asc":
          return (a.lastModified ?? "").localeCompare(b.lastModified ?? "");
        case "date-desc":
          return (b.lastModified ?? "").localeCompare(a.lastModified ?? "");
        case "size-asc":
          return (a.size ?? 0) - (b.size ?? 0);
        case "size-desc":
          return (b.size ?? 0) - (a.size ?? 0);
        case "name-asc":
          return (a.name ?? a.url).localeCompare(b.name ?? b.url);
      }
    });
    return sorted;
  }, [assets, filter, source, search, sortKey, metaMap]);

  if (loading || !isAdmin) return null;

  const stats = {
    total: assets.length,
    images: assets.filter((a) => a.kind === "image").length,
    videos: assets.filter((a) => a.kind === "video").length,
    files: assets.filter((a) => a.kind === "file" || a.kind === "link").length,
    unused: assets.filter((a) => !a.usedOnSite).length,
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif">Assets library</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Every image, video and file uploaded or referenced on the site. Rename, tag, describe — or let AI write the metadata.
            </p>
          </div>
          <MigrateToR2Button assets={assets} />
        </div>

        <DropZoneUploader />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 mt-6">
          <Stat label="Total" value={stats.total} />
          <Stat label="Images" value={stats.images} />
          <Stat label="Videos" value={stats.videos} />
          <Stat label="Files" value={stats.files} />
          <Stat label="Unused" value={stats.unused} highlight={stats.unused > 0} />
        </div>

        <div className="bg-white border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-center text-sm">
          <div className="flex gap-1">
            {(["all", "images", "videos", "files", "unused"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs capitalize ${filter === f ? "bg-black text-white" : "border hover:bg-neutral-50"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="size-desc">Largest first</option>
            <option value="size-asc">Smallest first</option>
            <option value="name-asc">Name A→Z</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          >
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="Search name, url, alt, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1 text-xs flex-1 min-w-[180px]"
          />
          <span className="text-xs text-neutral-500 ml-auto">{shown.length} of {assets.length}</span>
        </div>

        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading assets…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((a, i) => (
              <AssetCard key={a.url + i} asset={a} meta={metaMap[a.url]} />
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

// -----------------------------------------------------------------------------
// asset card
// -----------------------------------------------------------------------------

function AssetCard({ asset, meta }: { asset: SiteAsset; meta?: AssetMeta }) {
  const save = useServerFn(saveAssetMeta);
  const generate = useServerFn(generateAssetMeta);
  const removeR2 = useServerFn(deleteR2Object);
  const replaceR2 = useServerFn(replaceR2Object);
  const rename = useServerFn(renameR2Object);
  const readSource = useServerFn(readR2Object);
  const writeVariants = useServerFn(writeR2Variants);
  const qc = useQueryClient();

  const [label, setLabel] = useState(meta?.label ?? "");
  const [alt, setAlt] = useState(meta?.alt ?? asset.alt ?? "");
  const [caption, setCaption] = useState(meta?.caption ?? "");
  const [description, setDescription] = useState(meta?.description ?? "");
  const [tagsInput, setTagsInput] = useState((meta?.tags ?? []).join(", "));

  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [optInfo, setOptInfo] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLabel(meta?.label ?? "");
    setAlt(meta?.alt ?? asset.alt ?? "");
    setCaption(meta?.caption ?? "");
    setDescription(meta?.description ?? "");
    setTagsInput((meta?.tags ?? []).join(", "));
    setDirty(false);
  }, [meta, asset.alt]);

  const parseTags = (v: string) =>
    v.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);

  const doSave = async (over?: Partial<AssetMeta>) => {
    setSaving(true);
    try {
      await save({
        data: {
          url: asset.url,
          label: (over?.label ?? label) || null,
          alt: (over?.alt ?? alt) || null,
          caption: (over?.caption ?? caption) || null,
          description: (over?.description ?? description) || null,
          tags: over?.tags ?? parseTags(tagsInput),
        },
      });
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
        data: { imageUrl: asset.url, context: asset.source, kind: asset.kind === "file" ? "link" : asset.kind },
      });
      if (out.label) setLabel(out.label);
      if (out.alt) setAlt(out.alt);
      if (out.caption) setCaption(out.caption);
      if (out.description) setDescription(out.description);
      if (out.tags?.length) setTagsInput(out.tags.join(", "));
      await doSave({
        label: out.label || null,
        alt: out.alt || null,
        caption: out.caption || null,
        description: out.description || null,
        tags: out.tags ?? [],
      });
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const doRename = async () => {
    if (!asset.r2Key) return;
    const current = asset.name ?? asset.r2Key.split("/").pop() ?? "";
    const next = window.prompt("New file name (extension optional):", current);
    if (!next || next === current) return;
    setRenaming(true);
    try {
      await rename({ data: { fromKey: asset.r2Key, toName: next } });
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      alert("Rename failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRenaming(false);
    }
  };

  const backupKey = asset.r2Key ? `_originals/${asset.r2Key}` : null;
  const backupUrl = asset.r2Key && asset.url.endsWith(asset.r2Key)
    ? `${asset.url.slice(0, -asset.r2Key.length)}${backupKey}`
    : null;

  const doOptimize = async (maxW = 1600, quality = 0.8) => {
    if (!asset.r2Key || !backupKey || asset.kind !== "image") return;
    setOptBusy(true);
    setOptInfo("Reading original from R2…");
    try {
      // 1. Read the original bytes directly from the R2 bucket binding —
      //    never via the public CDN URL (CORS/edge caching would cause
      //    "Load failed").
      const source = await readSource({ data: { key: asset.r2Key } });
      const origSize = source.size;
      const origContentType = source.contentType;
      const origBlob = new Blob([Uint8Array.from(atob(source.dataBase64), (c) => c.charCodeAt(0))], {
        type: origContentType,
      });

      setOptInfo(`Encoding variants (${Math.round(origSize / 1024)} KB original)…`);
      const variants = await optimizeImageBlob(origBlob, { maxW, quality });

      const mainKey = withExt(asset.r2Key, "webp");
      const jpegKey = withExt(asset.r2Key, "jpg");
      const thumbKey = withSuffix(mainKey, "thumb", "webp");
      const avifKey = withExt(asset.r2Key, "avif");

      setOptInfo("Uploading optimized variants…");
      const [mainB64, jpegB64, thumbB64, origB64, avifB64] = await Promise.all([
        optBlobToBase64(variants.webp),
        optBlobToBase64(variants.jpeg),
        optBlobToBase64(variants.thumb),
        optBlobToBase64(origBlob),
        variants.avif ? optBlobToBase64(variants.avif) : Promise.resolve<string | null>(null),
      ]);

      const siblings = [
        { key: jpegKey, contentType: "image/jpeg", dataBase64: jpegB64 },
        { key: thumbKey, contentType: "image/webp", dataBase64: thumbB64 },
      ];
      if (avifB64) siblings.push({ key: avifKey, contentType: "image/avif", dataBase64: avifB64 });

      await writeVariants({
        data: {
          main: { key: mainKey, contentType: "image/webp", dataBase64: mainB64 },
          siblings,
          // Only write the backup the first time — the "true original" must
          // survive re-optimizations. If the key is unchanged (already .webp),
          // still keep the pre-optimization bytes as backup for Revert.
          backup: { key: backupKey, contentType: origContentType, dataBase64: origB64 },
        },
      });

      // If the optimized main uses a new extension (jpg → webp), remove the old key.
      if (mainKey !== asset.r2Key) {
        try {
          await removeR2({ data: { key: asset.r2Key } });
        } catch (e) {
          console.warn("Could not remove pre-optimized key", asset.r2Key, e);
        }
      }

      const newSize = variants.webp.size;
      const pct = origSize > 0 ? Math.round((1 - newSize / origSize) * 100) : 0;
      setOptInfo(
        `${Math.round(origSize / 1024)} → ${Math.round(newSize / 1024)} KB (−${pct}%) · ${variants.width}×${variants.height} · webp + jpg${variants.avif ? " + avif" : ""} + thumb`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOptInfo(null);
      alert("Optimize failed: " + msg);
    } finally {
      setOptBusy(false);
    }
  };


  const doRevert = async () => {
    if (!asset.r2Key || !backupUrl) return;
    setOptBusy(true);
    setOptInfo(null);
    try {
      const res = await fetch(backupUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("Backup fetch failed");
      const blob = await res.blob();
      const ct = res.headers.get("content-type") || "application/octet-stream";
      const b64 = await blobToBase64(blob);
      await replaceR2({ data: { key: asset.r2Key, contentType: ct, dataBase64: b64 } });
      setOptInfo(`Reverted (${Math.round(blob.size / 1024)} KB)`);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      alert("Revert failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOptBusy(false);
    }
  };

  const doDelete = async () => {
    if (!asset.r2Key) {
      alert("This asset is referenced from site content but is not an R2 object. Remove it from its gallery, setting, or video list.");
      return;
    }
    const msg =
      `Delete this file permanently?\n\n${asset.name ?? asset.r2Key}\n\n` +
      (asset.usedOnSite ? "⚠️ This file is used on the site — it will disappear from any gallery that references it.\n\n" : "") +
      "This cannot be undone.";
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      await removeR2({ data: { key: asset.r2Key } });
      setDeleted(true);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
      qc.invalidateQueries({ queryKey: ["admin", "asset-meta"] });
    } catch (e) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleting(false);
    }
  };

  if (deleted) return null;

  return (
    <div className="bg-white border rounded overflow-hidden flex flex-col">
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="block aspect-video bg-neutral-100 relative overflow-hidden"
        title={asset.url}
      >
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
        ) : asset.kind === "video" ? (
          <video src={asset.url} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs uppercase tracking-wider">
            {asset.kind === "link" ? "🔗 link" : "📄 file"}
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
        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
          <span className="truncate" title={asset.name ?? asset.url}>{asset.name ?? asset.source}</span>
          <span className="shrink-0 flex gap-2 font-mono">
            {humanSize(asset.size)}{asset.size && asset.lastModified ? " · " : ""}{humanDate(asset.lastModified)}
          </span>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={copyUrl}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded border hover:bg-neutral-50"
            title="Copy public URL"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy URL"}
          </button>
          <button
            type="button"
            onClick={doRename}
            disabled={renaming || !asset.r2Key}
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border hover:bg-neutral-50 disabled:opacity-40"
            title={asset.r2Key ? "Rename file in R2" : "Only R2 files can be renamed"}
          >
            {renaming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
          </button>
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border hover:bg-neutral-50"
            title="Open original in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

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

        {expanded && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Caption</span>
              <input
                value={caption}
                onChange={(e) => { setCaption(e.target.value); setDirty(true); }}
                placeholder="Short caption shown under the image"
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Description</span>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                placeholder="Longer descriptive text"
                rows={3}
                className="border rounded px-2 py-1 resize-y"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Tags (comma separated)</span>
              <input
                value={tagsInput}
                onChange={(e) => { setTagsInput(e.target.value); setDirty(true); }}
                placeholder="portrait, editorial, studio"
                className="border rounded px-2 py-1"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-neutral-500 hover:text-black self-start"
        >
          {expanded ? "− Fewer fields" : "+ Caption, description & tags"}
        </button>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={doAi}
            disabled={aiBusy || saving}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI write all
          </button>
          <button
            type="button"
            onClick={() => doSave()}
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
                disabled={optBusy || !asset.r2Key}
                title={asset.r2Key ? "Resize max 1600px → WebP. Keeps a backup." : "Upload to R2 first"}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {optBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Optimize
              </button>
              <button
                type="button"
                onClick={doRevert}
                disabled={optBusy || !asset.r2Key}
                title="Restore from the last Optimize backup"
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3 h-3" />
                Revert
              </button>
            </div>
            {optInfo && <div className="text-[10px] text-emerald-700 truncate">{optInfo}</div>}
          </>
        )}

        <button
          type="button"
          onClick={doDelete}
          disabled={deleting || !asset.r2Key}
          title={asset.r2Key ? "Permanently delete this R2 file" : "Referenced asset — remove it from its source"}
          className="mt-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// stat + uploader + migrate
// -----------------------------------------------------------------------------

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${highlight ? "border-yellow-400" : ""}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-serif">{value}</div>
    </div>
  );
}

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: string;
  error?: string;
  done?: boolean;
  reductionPct?: number;
  optimizedSize?: number;
};

function DropZoneUploader() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("uploads");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const doUploadR2 = useServerFn(uploadToR2);
  const writeVariants = useServerFn(writeR2Variants);

  const patch = (id: string, changes: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const onFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      const startId = Date.now();
      const initial: UploadItem[] = files.map((f, i) => ({
        id: `${startId}-${i}`,
        name: f.name,
        size: f.size,
        progress: 0,
        status: "queued",
      }));
      setItems((prev) => [...initial, ...prev].slice(0, 30));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = initial[i].id;
        const isImage = (file.type || "").startsWith("image/");
        try {
          if (isImage) {
            // Upload the original first so it can be re-optimized later, then
            // run the shared optimize pipeline and publish the variants that
            // the site actually serves.
            patch(id, { progress: 10, status: "uploading original" });
            const origB64 = await optBlobToBase64(file);
            const uploaded = await doUploadR2({
              data: {
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                dataBase64: origB64,
                folder,
              },
            });
            patch(id, { progress: 45, status: "optimizing" });
            const variants = await optimizeImageBlob(file);
            const mainKey = withExt(uploaded.key, "webp");
            const jpegKey = withExt(uploaded.key, "jpg");
            const thumbKey = withSuffix(mainKey, "thumb", "webp");
            const avifKey = withExt(uploaded.key, "avif");

            patch(id, { progress: 70, status: "publishing variants" });
            const [mainB64, jpegB64, thumbB64, avifB64] = await Promise.all([
              optBlobToBase64(variants.webp),
              optBlobToBase64(variants.jpeg),
              optBlobToBase64(variants.thumb),
              variants.avif ? optBlobToBase64(variants.avif) : Promise.resolve<string | null>(null),
            ]);
            const siblings = [
              { key: jpegKey, contentType: "image/jpeg", dataBase64: jpegB64 },
              { key: thumbKey, contentType: "image/webp", dataBase64: thumbB64 },
            ];
            if (avifB64) siblings.push({ key: avifKey, contentType: "image/avif", dataBase64: avifB64 });
            await writeVariants({
              data: {
                main: { key: mainKey, contentType: "image/webp", dataBase64: mainB64 },
                siblings,
              },
            });
            const pct = file.size > 0 ? Math.round((1 - variants.webp.size / file.size) * 100) : 0;
            patch(id, {
              progress: 100,
              done: true,
              status: `${Math.round(file.size / 1024)} → ${Math.round(variants.webp.size / 1024)} KB (−${pct}%)`,
              optimizedSize: variants.webp.size,
              reductionPct: pct,
            });
          } else {
            patch(id, { progress: 20, status: "uploading" });
            const b64 = await optBlobToBase64(file);
            patch(id, { progress: 60, status: "uploading" });
            await doUploadR2({
              data: {
                filename: file.name,
                contentType: file.type || "application/octet-stream",
                dataBase64: b64,
                folder,
              },
            });
            patch(id, { progress: 100, done: true, status: "done" });
          }
        } catch (e) {
          patch(id, {
            error: e instanceof Error ? e.message : String(e),
            progress: 100,
            status: "failed",
          });
        }
      }
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
      qc.invalidateQueries({ queryKey: ["media-picker", "assets"] });
      setBusy(false);
    },
    [doUploadR2, folder, qc, writeVariants],
  );


  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        onFiles(files);
      }}
      className={`bg-white border-2 border-dashed rounded-lg p-6 text-center transition ${dragOver ? "border-black bg-neutral-100" : "border-neutral-300"}`}
    >
      <div className="flex flex-col items-center gap-2">
        <UploadCloud className="w-6 h-6 text-neutral-500" />
        <div className="text-sm">
          <strong>Drop files here</strong> or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="underline decoration-dotted hover:text-black"
          >
            browse
          </button>
          {" "}to upload to Cloudflare R2
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          Folder:
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="uploads"
            className="border rounded px-2 py-0.5 text-xs w-32"
          />
          <span className="inline-flex items-center gap-1 rounded border px-2 py-0.5">
            <Cloud className="h-3 w-3" /> R2
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            onFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-1 text-left max-h-40 overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{it.name}</span>
                <span className="shrink-0 text-neutral-500 font-mono">
                  {humanSize(it.size)} · {it.error ? "failed" : it.status || (it.done ? "done" : `${it.progress}%`)}
                </span>
              </div>
              <div className="h-1 bg-neutral-200 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${it.error ? "bg-red-500" : it.done ? "bg-emerald-500" : "bg-black"}`}
                  style={{ width: `${it.progress}%` }}
                />
              </div>
              {it.error && <div className="text-red-600 truncate">{it.error}</div>}
            </div>
          ))}
        </div>
      )}

      {busy && <div className="mt-2 text-xs text-neutral-500">Uploading…</div>}
    </div>
  );
}

function MigrateToR2Button({ assets }: { assets: SiteAsset[] }) {
  const qc = useQueryClient();
  const migrate = useServerFn(migrateSupabaseToR2);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-neutral-600">{msg}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm("Check the R2 migration status? New uploads already go directly to Cloudflare R2.")) return;
          setBusy(true);
          setMsg("Migrating…");
          try {
            const candidates = Array.from(
              new Map(
                assets
                  .filter((asset) => !asset.r2Key && /^https?:\/\//.test(asset.url))
                  .map((asset) => [asset.url, { url: asset.url, name: asset.name, contentType: asset.contentType }]),
              ).values(),
            );
            const r = await migrate({ data: { assets: candidates } }) as {
              totalFiles: number; copied: number; skipped: number; failed: number; rewrites: number; message?: string;
            };
            setMsg(`${r.copied} copied, ${r.skipped} skipped, ${r.failed} failed${r.message ? ` · ${r.message}` : ""}`);
            qc.invalidateQueries({ queryKey: ["admin", "assets"] });
          } catch (e) {
            setMsg(`Migration error: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-black text-black hover:bg-black hover:text-white text-xs"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
        Migrate → R2
      </button>
    </div>
  );
}
