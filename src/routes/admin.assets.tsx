import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllAssets, type SiteAsset } from "@/lib/assets.functions";
import { listAssetMeta, saveAssetMeta, generateAssetMeta, type AssetMeta } from "@/lib/asset-meta.functions";
import { uploadToR2, deleteR2Object, migrateSupabaseToR2, replaceR2Object } from "@/lib/r2.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, Zap, Undo2, ExternalLink, Trash2, Cloud } from "lucide-react";
import { useRef } from "react";



export const Route = createFileRoute("/admin/assets")({
  head: () => ({ meta: [{ title: "Assets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAssetsPage,
});

function collectSettingUrls(value: unknown, key: string, out: SiteAsset[]) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) {
      out.push({ kind: /\.(mp4|webm|mov)(\?.*)?$/i.test(value) ? "video" : "image", url: value, source: `Setting: ${key}`, usedOnSite: true });
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
        referenced.push({ kind: "image", url: image.src, source: `Gallery: ${gallery.slug}`, alt: image.alt, usedOnSite: true });
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
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif">Assets library</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Every image, video and link ever uploaded or referenced on the site. Edit label & alt text — or let AI write them.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <DirectUpload />
            <MigrateToR2Button assets={assets} />
          </div>
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


function AssetCard({ asset, meta }: { asset: SiteAsset; meta?: AssetMeta }) {
  const save = useServerFn(saveAssetMeta);
  const generate = useServerFn(generateAssetMeta);
  const removeR2 = useServerFn(deleteR2Object);
  const replaceR2 = useServerFn(replaceR2Object);
  const qc = useQueryClient();
  const [label, setLabel] = useState(meta?.label ?? "");
  const [alt, setAlt] = useState(meta?.alt ?? asset.alt ?? "");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [optBusy, setOptBusy] = useState(false);
  const [optInfo, setOptInfo] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);



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

  const backupKey = asset.r2Key ? `_originals/${asset.r2Key}` : null;
  const backupUrl = asset.r2Key && asset.url.endsWith(asset.r2Key)
    ? `${asset.url.slice(0, -asset.r2Key.length)}${backupKey}`
    : null;

  const doOptimize = async (maxW = 1600, quality = 0.75) => {
    if (!asset.r2Key || !backupKey || asset.kind !== "image") return;
    setOptBusy(true);
    setOptInfo(null);
    try {
      const res = await fetch(asset.url, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const origBlob = await res.blob();
      const origSize = origBlob.size;
      const origContentType = res.headers.get("content-type") || undefined;
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
      const [origB64, outB64] = await Promise.all([blobToBase64(origBlob), blobToBase64(outBlob)]);
      await replaceR2({
        data: {
          key: asset.r2Key,
          contentType: "image/webp",
          dataBase64: outB64,
          backupKey,
          origBase64: origB64,
          origContentType,
        },
      });
      setOptInfo(`${Math.round(origSize / 1024)} → ${Math.round(outBlob.size / 1024)} KB · ${w}×${h}`);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (e) {
      alert("Optimize failed: " + (e instanceof Error ? e.message : String(e)));
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
      await replaceR2({
        data: { key: asset.r2Key, contentType: ct, dataBase64: b64 },
      });
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

  const doDelete = async () => {
    if (!asset.r2Key) {
      alert("This asset is referenced from site content but is not an R2 object. Remove it from its gallery, setting, or video list.");
      return;
    }
    const msg =
      `Delete this image permanently?\n\n${asset.name ?? asset.r2Key}\n\n` +
      (asset.usedOnSite
        ? "⚠️ This image is used on the site — it will disappear from any gallery that references it.\n\n"
        : "") +
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
                disabled={optBusy || !asset.r2Key}
                title={
                  asset.r2Key
                    ? "Resize to max 1600px and re-encode as WebP in Cloudflare R2. Keeps a backup so you can Revert."
                    : "Referenced image outside R2 — upload it to Assets first to enable Optimize."
                }
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {optBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Optimize
              </button>
              <button
                type="button"
                onClick={doRevert}
                disabled={optBusy || !asset.r2Key}
                title={
                  asset.r2Key
                    ? "Restore this image from the R2 backup saved before the last Optimize."
                    : "Revert only works for images stored in Cloudflare R2."
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
        <button
          type="button"
          onClick={doDelete}
          disabled={deleting || !asset.r2Key}
          title={
            asset.r2Key
              ? "Permanently delete this R2 file (asks for confirmation)."
              : "Referenced asset — delete it from its original gallery/setting instead."
          }
          className="mt-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete
        </button>

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

function DirectUpload() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("uploads");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const doUploadR2 = useServerFn(uploadToR2);

  const fileToBase64 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  };

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setMsg(null);
    let ok = 0;
    let fail = 0;
    try {
      for (const file of files) {
        try {
          const b64 = await fileToBase64(file);
          await doUploadR2({
            data: {
              filename: file.name,
              contentType: file.type || "application/octet-stream",
              dataBase64: b64,
              folder,
            },
          });
          ok++;
        } catch (e) {
          fail++;
          console.error("upload failed", file.name, e);
          setMsg(`Upload failed for ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (fail === 0) setMsg(`${ok} uploaded`);
      qc.invalidateQueries({ queryKey: ["admin", "assets"] });
      qc.invalidateQueries({ queryKey: ["media-picker", "assets"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-3 flex items-center gap-2 text-sm flex-wrap">
      <span className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-neutral-700">
        <Cloud className="h-3 w-3" /> Cloudflare R2
      </span>
      <input
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        placeholder="folder (e.g. uploads)"
        className="border rounded px-2 py-1 text-xs w-32"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
        Upload files
      </button>
      {msg && <span className="text-xs text-neutral-600">{msg}</span>}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/*"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          onFiles(files);
          e.target.value = "";
        }}
      />
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
              totalFiles: number;
              copied: number;
              skipped: number;
              failed: number;
              rewrites: number;
              message?: string;
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
        Migrate Media → R2
      </button>
    </div>
  );
}

