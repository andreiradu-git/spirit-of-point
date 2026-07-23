import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

function AdminSeoPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

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

  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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

  const save = async (path: string) => {
    setSaving(path);
    const r = rows[path];
    const { error } = await supabase.from("page_seo").upsert({
      path,
      title: r.title || null,
      description: r.description || null,
      keywords: r.keywords || null,
      og_image: r.og_image || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "path" });
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

  if (loading || !isAdmin) return null;

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
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <code className="text-xs text-neutral-500">{p.path}</code>
                  </div>
                  <div className="flex gap-2">
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
      </div>
    </div>
  );
}
