import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useSocials, SOCIAL_ICON_PATHS, type SocialLink, type SocialIconKey } from "@/hooks/use-socials";

export const Route = createFileRoute("/admin/socials")({
  head: () => ({ meta: [{ title: "Social links — Admin" }, { name: "robots", content: "noindex" }] }),
  component: SocialsPage,
});

const ICON_OPTIONS: SocialIconKey[] = ["facebook", "instagram", "pinterest", "linkedin", "twitter", "youtube", "tiktok"];

function SocialsPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const { socials, save } = useSocials();
  const [items, setItems] = useState<SocialLink[]>(socials);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setItems(socials), [socials]);
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) return null;

  const update = (i: number, patch: Partial<SocialLink>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const add = () =>
    setItems((prev) => [...prev, { icon: "instagram", label: "New", href: "https://", enabled: true }]);

  const doSave = async () => {
    setSaving(true);
    try {
      await save(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-serif">Social links</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Manage the icons shown in the header and footer. Paste your real profile URLs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={add} className="px-3 py-2 text-sm border border-neutral-300 rounded bg-white hover:bg-neutral-100">
              + Add
            </button>
            <button
              onClick={doSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded p-4 flex flex-wrap items-center gap-3">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current text-neutral-700 shrink-0">
                <path d={SOCIAL_ICON_PATHS[it.icon]} />
              </svg>
              <select
                value={it.icon}
                onChange={(e) => update(i, { icon: e.target.value as SocialIconKey })}
                className="border border-neutral-300 rounded px-2 py-1 text-sm"
              >
                {ICON_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <input
                value={it.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label (aria)"
                className="border border-neutral-300 rounded px-2 py-1 text-sm w-40"
              />
              <input
                value={it.href}
                onChange={(e) => update(i, { href: e.target.value })}
                placeholder="https://…"
                className="border border-neutral-300 rounded px-2 py-1 text-sm flex-1 min-w-[220px]"
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={it.enabled !== false}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
                Visible
              </label>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} className="px-2 py-1 text-xs border rounded" aria-label="Move up">↑</button>
                <button onClick={() => move(i, 1)} className="px-2 py-1 text-xs border rounded" aria-label="Move down">↓</button>
                <button onClick={() => remove(i)} className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-neutral-500 bg-white border border-dashed border-neutral-300 rounded p-6 text-center">
              No social links yet. Click "+ Add".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
