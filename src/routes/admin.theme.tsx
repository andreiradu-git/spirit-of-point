import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { useEffect, useState } from "react";
import { DEFAULT_THEME, useTheme, useSaveTheme, type ThemeConfig } from "@/hooks/use-theme";

export const Route = createFileRoute("/admin/theme")({
  head: () => ({ meta: [{ title: "Theme — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ThemePage,
});

const FONT_OPTIONS = [
  "Cormorant Garamond", "Playfair Display", "Instrument Serif", "DM Serif Display",
  "Libre Baskerville", "Cormorant", "Lora", "Space Grotesk", "Inter", "DM Sans",
  "Manrope", "Work Sans", "Figtree", "Outfit", "Jost", "Poppins", "Montserrat",
  "Archivo", "Bebas Neue", "Syne", "Urbanist", "Nunito Sans", "JetBrains Mono",
];

function ThemePage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const current = useTheme();
  const save = useSaveTheme();
  const [t, setT] = useState<ThemeConfig>(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => setT(current), [current]);
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) return null;

  const set = (patch: Partial<ThemeConfig>) => setT((p) => ({ ...p, ...patch }));
  const setColor = (k: keyof ThemeConfig["colors"], v: string) =>
    setT((p) => ({ ...p, colors: { ...p.colors, [k]: v } }));
  const setFont = (k: keyof ThemeConfig["fonts"], v: string) =>
    setT((p) => ({ ...p, fonts: { ...p.fonts, [k]: v } }));

  const doSave = async () => {
    setSaving(true);
    try {
      await save(t);
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
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-serif">Site theme</h1>
            <p className="text-sm text-neutral-600 mt-1">Change fonts and colors used across the whole site. Applied live.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setT(DEFAULT_THEME)}
              className="text-xs px-3 py-1.5 border rounded hover:bg-white"
            >
              Reset to defaults
            </button>
            <button
              onClick={doSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 bg-black text-white rounded disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save & apply"}
            </button>
          </div>
        </div>

        <Section title="Fonts">
          <FontSelect label="Heading font" value={t.fonts.heading} onChange={(v) => setFont("heading", v)} />
          <FontSelect label="Body font" value={t.fonts.body} onChange={(v) => setFont("body", v)} />
          <TextField label="Heading weights" value={t.fonts.headingWeights} onChange={(v) => setFont("headingWeights", v)} hint="e.g. 300;400;500" />
          <TextField label="Body weights" value={t.fonts.bodyWeights} onChange={(v) => setFont("bodyWeights", v)} hint="e.g. 300;400;500;600" />
        </Section>

        <Section title="Colors">
          <ColorField label="Background" value={t.colors.bg} onChange={(v) => setColor("bg", v)} />
          <ColorField label="Text" value={t.colors.text} onChange={(v) => setColor("text", v)} />
          <ColorField label="Muted text" value={t.colors.muted} onChange={(v) => setColor("muted", v)} />
          <ColorField label="Accent" value={t.colors.accent} onChange={(v) => setColor("accent", v)} />
          <ColorField label="Borders / dividers" value={t.colors.border} onChange={(v) => setColor("border", v)} />
          <ColorField label="Header background" value={t.colors.headerBg} onChange={(v) => setColor("headerBg", v)} allowTransparent />
          <ColorField label="Header text" value={t.colors.headerText} onChange={(v) => setColor("headerText", v)} />
          <ColorField label="Footer background" value={t.colors.footerBg} onChange={(v) => setColor("footerBg", v)} />
          <ColorField label="Footer text" value={t.colors.footerText} onChange={(v) => setColor("footerText", v)} />
        </Section>

        <Section title="Preview">
          <div
            className="border rounded-lg overflow-hidden"
            style={{ background: t.colors.bg, color: t.colors.text, borderColor: t.colors.border }}
          >
            <div style={{ background: t.colors.headerBg, color: t.colors.headerText }} className="px-6 py-4 text-sm">
              Header sample
            </div>
            <div className="p-8">
              <h2 style={{ fontFamily: `"${t.fonts.heading}", serif` }} className="text-4xl mb-3">
                The quick brown fox jumps over the lazy dog
              </h2>
              <p style={{ fontFamily: `"${t.fonts.body}", sans-serif` }} className="text-base mb-2">
                This is body copy in your selected typeface. It should feel calm, readable, and on-brand.
              </p>
              <p style={{ color: t.colors.muted, fontFamily: `"${t.fonts.body}", sans-serif` }} className="text-sm">
                Muted / secondary text lives here.
              </p>
              <button
                style={{ background: t.colors.accent, color: t.colors.bg, fontFamily: `"${t.fonts.body}", sans-serif` }}
                className="mt-4 px-4 py-2 rounded text-sm"
              >
                Accent button
              </button>
            </div>
            <div style={{ background: t.colors.footerBg, color: t.colors.footerText }} className="px-6 py-4 text-xs">
              Footer sample
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-5 mb-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      <div className="grid md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-600">{label}</span>
      <select
        value={FONT_OPTIONS.includes(value) ? value : "__custom"}
        onChange={(e) => {
          if (e.target.value === "__custom") return;
          onChange(e.target.value);
        }}
        className="w-full border rounded px-3 py-1.5 text-sm mt-1"
      >
        {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        <option value="__custom">Custom…</option>
      </select>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-1.5 text-sm mt-1"
        placeholder="Google Fonts family name"
      />
    </label>
  );
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-1.5 text-sm mt-1"
      />
      {hint && <span className="text-[10px] text-neutral-500">{hint}</span>}
    </label>
  );
}

function ColorField({ label, value, onChange, allowTransparent }: { label: string; value: string; onChange: (v: string) => void; allowTransparent?: boolean }) {
  const isTransparent = value === "transparent";
  return (
    <label className="block">
      <span className="text-xs text-neutral-600">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={isTransparent ? "#ffffff" : value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 border rounded"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        {allowTransparent && (
          <button
            type="button"
            onClick={() => onChange(isTransparent ? "#000000" : "transparent")}
            className="text-[10px] px-2 py-1 border rounded"
          >
            {isTransparent ? "Solid" : "Transparent"}
          </button>
        )}
      </div>
    </label>
  );
}
