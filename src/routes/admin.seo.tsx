import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateSeoContent } from "@/lib/seo-ai.functions";

export const Route = createFileRoute("/admin/seo")({
  head: () => ({ meta: [{ title: "SEO & AI Visibility — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSeoPage,
});

const DEFAULT_PAGES = [
  { path: "/", label: "Home" },
  { path: "/food", label: "Food Photography" },
  { path: "/people", label: "People & Portrait" },
  { path: "/editorial", label: "Editorial" },
  { path: "/patterns", label: "Patterns" },
  { path: "/video", label: "Video" },
  { path: "/contact", label: "Contact" },
];

const KEYWORD_SUGGESTIONS = [
  "best professional photography",
  "best food photography",
  "best food photographer",
  "product photography",
  "advertising photography",
  "corporate photography",
  "portrait photography",
  "commercial photographer Bucharest",
  "editorial photography",
  "still life photography",
  "photo studio Bucharest",
  "photo video studio Romania",
];

type Row = {
  path: string;
  title: string;
  description: string;
  keywords: string;
  og_image: string;
};

type GalleryImage = { id: string; src: string; alt: string | null; gallery_id: string };

function AdminSeoPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runAi = useServerFn(generateSeoContent);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const { data: existing } = useQuery({
    queryKey: ["page_seo", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("page_seo").select("*");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!isAdmin,
  });

  const { data: galleryImages } = useQuery({
    queryKey: ["gallery_images", "seo-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("id, src, alt, gallery_id");
      if (error) throw error;
      return (data ?? []) as GalleryImage[];
    },
    enabled: !!isAdmin,
  });

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [altBusy, setAltBusy] = useState<string | null>(null);
  const [altAllBusy, setAltAllBusy] = useState(false);

  useEffect(() => {
    const map: Record<string, Row> = {};
    for (const p of DEFAULT_PAGES) {
      const e = existing?.find((r) => r.path === p.path);
      map[p.path] = {
        path: p.path,
        title: e?.title ?? "",
        description: e?.description ?? "",
        keywords: e?.keywords ?? "",
        og_image: e?.og_image ?? "",
      };
    }
    setRows(map);
  }, [existing]);

  const seoScore = useMemo(() => {
    const totalPages = DEFAULT_PAGES.length;
    const pagesWithMeta = DEFAULT_PAGES.filter((p) => {
      const e = existing?.find((r) => r.path === p.path);
      return !!(e?.title && e?.description);
    }).length;
    const totalImages = galleryImages?.length ?? 0;
    const imagesWithAlt = galleryImages?.filter((i) => (i.alt ?? "").trim().length > 0).length ?? 0;
    const metaPct = totalPages ? Math.round((pagesWithMeta / totalPages) * 100) : 0;
    const altPct = totalImages ? Math.round((imagesWithAlt / totalImages) * 100) : 0;
    const overall = Math.round((metaPct + altPct) / 2);
    return { totalPages, pagesWithMeta, totalImages, imagesWithAlt, metaPct, altPct, overall };
  }, [existing, galleryImages]);

  const save = async (path: string) => {
    setSaving(path);
    const r = rows[path];
    const { error } = await supabase.from("page_seo").upsert(
      {
        path,
        title: r.title || null,
        description: r.description || null,
        keywords: r.keywords || null,
        og_image: r.og_image || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "path" },
    );
    setSaving(null);
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    setSaved(path);
    setTimeout(() => setSaved(null), 2000);
    qc.invalidateQueries({ queryKey: ["page_seo"] });
  };

  const applyDefault = (path: string) => {
    const label = DEFAULT_PAGES.find((p) => p.path === path)?.label ?? "";
    setRows((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        keywords: KEYWORD_SUGGESTIONS.join(", "),
        title: prev[path].title || `${label} — Point Studio Bucharest`,
        description:
          prev[path].description ||
          `${label} by Point Studio — best professional photography in Bucharest for food, product, advertising, corporate and portrait work.`,
      },
    }));
  };

  const aiFill = async (path: string) => {
    setAiBusy(path);
    try {
      const label = DEFAULT_PAGES.find((p) => p.path === path)?.label ?? "";
      const out = await runAi({
        data: {
          kind: "seo",
          path,
          label,
          extraKeywords: rows[path]?.keywords || undefined,
        },
      });
      setRows((prev) => ({
        ...prev,
        [path]: {
          ...prev[path],
          title: out.title || prev[path].title,
          description: out.description || prev[path].description,
          keywords: out.keywords || prev[path].keywords,
        },
      }));
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(null);
    }
  };

  const aiAlt = async (img: GalleryImage, context: string) => {
    setAltBusy(img.id);
    try {
      const out = await runAi({
        data: { kind: "alt", imageUrl: img.src, context },
      });
      const alt = out.alt;
      if (alt) {
        const { error } = await supabase.from("gallery_images").update({ alt }).eq("id", img.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["gallery_images"] });
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAltBusy(null);
    }
  };

  const aiAltAll = async () => {
    if (!galleryImages) return;
    const missing = galleryImages.filter((i) => !(i.alt ?? "").trim());
    if (!missing.length) return;
    if (!confirm(`Generate alt text for ${missing.length} images? This uses AI credits.`)) return;
    setAltAllBusy(true);
    try {
      // Sequential to avoid rate limits
      for (const img of missing) {
        try {
          const out = await runAi({
            data: { kind: "alt", imageUrl: img.src, context: "Point Studio portfolio" },
          });
          if (out.alt) {
            await supabase.from("gallery_images").update({ alt: out.alt }).eq("id", img.id);
          }
        } catch {
          // continue on error
        }
      }
      qc.invalidateQueries({ queryKey: ["gallery_images"] });
    } finally {
      setAltAllBusy(false);
    }
  };

  if (loading || !isAdmin) return null;

  const missingCount = galleryImages?.filter((i) => !(i.alt ?? "").trim()).length ?? 0;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif">SEO & AI Visibility</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Control how each page appears in Google, social shares and AI answers (ChatGPT, Perplexity, Gemini).
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link to="/admin/analytics" className="px-3 py-1.5 border rounded hover:bg-white">Analytics →</Link>
          </div>
        </div>

        {/* SEO Score */}
        <div className="bg-white border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium">SEO Score</div>
            <div className="text-3xl font-serif">{seoScore.overall}%</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ScoreBar
              label="Pages with metadata"
              value={seoScore.pagesWithMeta}
              total={seoScore.totalPages}
              pct={seoScore.metaPct}
            />
            <ScoreBar
              label="Images with alt text"
              value={seoScore.imagesWithAlt}
              total={seoScore.totalImages}
              pct={seoScore.altPct}
            />
          </div>
          {missingCount > 0 && (
            <div className="mt-4 flex items-center justify-between bg-neutral-50 border rounded p-3">
              <div className="text-xs text-neutral-700">
                {missingCount} image{missingCount === 1 ? "" : "s"} missing alt text. Let AI write them.
              </div>
              <button
                onClick={aiAltAll}
                disabled={altAllBusy}
                className="text-xs px-3 py-1.5 bg-black text-white rounded disabled:opacity-50"
              >
                {altAllBusy ? "Generating…" : `✨ AI generate all (${missingCount})`}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4 mb-6 text-sm">
          <div className="font-medium mb-2">Suggested keywords (click a page's "Apply defaults" to use)</div>
          <div className="flex flex-wrap gap-1.5">
            {KEYWORD_SUGGESTIONS.map((k) => (
              <span key={k} className="px-2 py-0.5 bg-neutral-100 rounded text-xs">{k}</span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {DEFAULT_PAGES.map((p) => {
            const r = rows[p.path];
            if (!r) return null;
            return (
              <div key={p.path} className="bg-white border rounded-lg p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <code className="text-xs text-neutral-500">{p.path}</code>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => aiFill(p.path)}
                      disabled={aiBusy === p.path}
                      className="text-xs px-2 py-1 border border-black rounded hover:bg-black hover:text-white disabled:opacity-50"
                      title="Use ChatGPT-style AI to write title, description and keywords"
                    >
                      {aiBusy === p.path ? "AI writing…" : "✨ AI write"}
                    </button>
                    <button
                      onClick={() => applyDefault(p.path)}
                      className="text-xs px-2 py-1 border rounded hover:bg-neutral-50"
                    >
                      Apply defaults
                    </button>
                    <button
                      onClick={() => save(p.path)}
                      disabled={saving === p.path}
                      className="text-xs px-3 py-1 bg-black text-white rounded disabled:opacity-50"
                    >
                      {saving === p.path ? "Saving…" : saved === p.path ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="text-xs text-neutral-600">Title (55–60 chars)</span>
                    <input
                      value={r.title}
                      onChange={(e) => setRows((p2) => ({ ...p2, [p.path]: { ...r, title: e.target.value } }))}
                      className="w-full border rounded px-3 py-1.5 text-sm mt-1"
                      maxLength={80}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-600">Meta description (150–160 chars)</span>
                    <textarea
                      value={r.description}
                      onChange={(e) => setRows((p2) => ({ ...p2, [p.path]: { ...r, description: e.target.value } }))}
                      className="w-full border rounded px-3 py-1.5 text-sm mt-1"
                      rows={2}
                      maxLength={200}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-600">Keywords (comma separated)</span>
                    <textarea
                      value={r.keywords}
                      onChange={(e) => setRows((p2) => ({ ...p2, [p.path]: { ...r, keywords: e.target.value } }))}
                      className="w-full border rounded px-3 py-1.5 text-sm mt-1"
                      rows={2}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-600">Social share image URL (optional)</span>
                    <input
                      value={r.og_image}
                      onChange={(e) => setRows((p2) => ({ ...p2, [p.path]: { ...r, og_image: e.target.value } }))}
                      className="w-full border rounded px-3 py-1.5 text-sm mt-1"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-image alt text audit */}
        {galleryImages && galleryImages.length > 0 && (
          <div className="bg-white border rounded-lg p-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-medium">Image alt text audit</div>
                <div className="text-xs text-neutral-500">
                  {seoScore.imagesWithAlt} / {seoScore.totalImages} images have alt text. Missing ones are listed below.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto">
              {galleryImages
                .filter((i) => !(i.alt ?? "").trim())
                .slice(0, 60)
                .map((img) => (
                  <div key={img.id} className="border rounded overflow-hidden">
                    <img src={img.src} alt="" className="w-full h-28 object-cover" />
                    <div className="p-2">
                      <button
                        onClick={() => aiAlt(img, "Point Studio portfolio")}
                        disabled={altBusy === img.id}
                        className="w-full text-[11px] px-2 py-1 border border-black rounded hover:bg-black hover:text-white disabled:opacity-50"
                      >
                        {altBusy === img.id ? "…" : "✨ AI alt"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            {missingCount > 60 && (
              <div className="text-xs text-neutral-500 mt-2">
                Showing first 60. Use "AI generate all" above to process the rest.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, total, pct }: { label: string; value: number; total: number; pct: number }) {
  const color = pct >= 80 ? "bg-green-600" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="text-neutral-500">
          {value} / {total} · {pct}%
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
