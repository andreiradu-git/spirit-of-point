import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText, useSaveText } from "@/hooks/use-site-texts";
import { useAiLanguage } from "@/hooks/use-ai-language";
import { useAiCredits } from "@/hooks/use-ai-credits";
import { generateGallerySeo } from "@/lib/gallery-seo.functions";
import { Loader2, Sparkles, RefreshCw, Save } from "lucide-react";

function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "");
}

/**
 * Editable, AI-assisted SEO article rendered at the bottom of every gallery page.
 * Content is stored as HTML in site_settings under `text.gallery-seo.<slug>`.
 */
export function GallerySeoSection({
  slug,
  title,
  location = "Bucharest",
}: {
  slug: string;
  title: string;
  location?: string;
}) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;

  const stored = useText(`gallery-seo.${slug}`, "");
  const save = useSaveText();
  const runAi = useServerFn(generateGallerySeo);
  const { lang } = useAiLanguage();
  const { remaining, limit, consume } = useAiCredits();

  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (editable && el && document.activeElement !== el && el.innerHTML !== stored) {
      el.innerHTML = stored;
    }
  }, [stored, editable]);

  const commit = async () => {
    const el = ref.current;
    if (!el) return;
    const next = sanitize(el.innerHTML).trim();
    if (next === stored) return;
    setSaving(true);
    try {
      await save(`gallery-seo.${slug}`, next);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (remaining <= 0) {
      alert(`Daily AI limit reached (${limit} generations per day).`);
      return;
    }
    if (stored && !confirm("Replace the current SEO text with a new AI version? This uses 1 AI credit."))
      return;
    setBusy(true);
    try {
      await consume();
      const out = await runAi({
        data: {
          gallerySlug: slug,
          galleryTitle: title,
          location,
          current: stored || undefined,
          language: lang,
        },
      });
      const html = sanitize(out.html || "");
      if (!html) throw new Error("AI returned empty content.");
      await save(`gallery-seo.${slug}`, html);
      if (ref.current) ref.current.innerHTML = html;
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const cmd = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
  };

  if (!editable && !stored) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24">
      <div className="border-t border-border pt-10">
        {editable && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-muted/60 p-2 text-xs">
            <button type="button" onClick={() => cmd("formatBlock", "H2")} className="px-2 py-1 rounded bg-background border border-border">H2</button>
            <button type="button" onClick={() => cmd("formatBlock", "H3")} className="px-2 py-1 rounded bg-background border border-border">H3</button>
            <button type="button" onClick={() => cmd("formatBlock", "P")} className="px-2 py-1 rounded bg-background border border-border">P</button>
            <button type="button" onClick={() => cmd("bold")} className="px-2 py-1 rounded bg-background border border-border font-bold">B</button>
            <button type="button" onClick={() => cmd("italic")} className="px-2 py-1 rounded bg-background border border-border italic">I</button>
            <button type="button" onClick={() => cmd("insertUnorderedList")} className="px-2 py-1 rounded bg-background border border-border">• List</button>
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={generate}
              disabled={busy || remaining <= 0}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-foreground text-background disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : stored ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {stored ? "Regenerate with AI" : "Generate with AI"}
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={saving}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background border border-border"
            >
              <Save className="w-3 h-3" />
              {saving ? "Saving…" : "Save"}
            </button>
            <span className="ml-auto text-muted-foreground">
              {remaining}/{limit} AI credits left today · 1 credit per generation · {lang.toUpperCase()}
            </span>
          </div>
        )}

        {editable ? (
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onBlur={commit}
            data-placeholder="Write or generate the SEO article for this gallery…"
            className="prose prose-neutral max-w-none text-[15px] leading-relaxed outline outline-1 outline-dashed outline-blue-400/60 focus:outline-blue-500 rounded-sm p-4 min-h-32"
          />
        ) : (
          <article
            className="prose prose-neutral max-w-none text-[15px] leading-relaxed [&_h2]:font-serif [&_h2]:italic [&_h2]:text-3xl [&_h2]:mb-4 [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-xs [&_h3]:mt-8 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: sanitize(stored) }}
          />
        )}
      </div>
    </section>
  );
}
