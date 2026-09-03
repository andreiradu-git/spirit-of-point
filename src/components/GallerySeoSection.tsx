import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText } from "@/hooks/use-site-texts";
import { useLang } from "@/i18n";
import { useAiCredits } from "@/hooks/use-ai-credits";
import { useGalleries } from "@/hooks/use-galleries";
import {
  EMPTY_GALLERY_SEO,
  useAllGallerySeo,
  useSaveGallerySeo,
  type GallerySeoData,
} from "@/hooks/use-gallery-seo";
import { generateGallerySeo } from "@/lib/gallery-seo.functions";
import { Loader2, Sparkles, RefreshCw, Save, Plus, Trash2 } from "lucide-react";

const SITE = "https://www.pointstudio.ro";
const TOP_LEVEL = new Set(["food", "people", "editorial", "patterns", "video"]);

/** Route path for any gallery slug — works for new CMS galleries with no code change. */
export function galleryPath(slug: string): string {
  return TOP_LEVEL.has(slug) ? `/${slug}` : `/work/${slug}`;
}

function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "");
}

function upsertMeta(sel: string, attr: string, name: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * CMS-driven SEO content block rendered under every gallery: editorial article,
 * FAQs, related galleries, editable meta fields and JSON-LD structured data.
 */
export function GallerySeoSection({
  slug,
  title,
  location,
  images = [],
  lang: langProp,
}: {
  slug: string;
  title: string;
  location?: string;
  images?: Array<{ src: string; alt?: string }>;
  lang?: "en" | "ro";
}) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: allSeo } = useAllGallerySeo();
  const saveSeo = useSaveGallerySeo();
  const legacy = useText(lang === "ro" ? `gallery-seo.${slug}#ro` : `gallery-seo.${slug}`, "");
  const { data: galleries } = useGalleries();
  const runAi = useServerFn(generateGallerySeo);
  const routeLang = useLang();
  const lang = langProp ?? routeLang;
  // Romanian SEO content is stored under a separate key so both languages coexist.
  const seoKey = lang === "ro" ? `${slug}#ro` : slug;
  const loc = location ?? (lang === "ro" ? "București" : "Bucharest");
  const { remaining, limit, consume } = useAiCredits();

  const stored: GallerySeoData = useMemo(() => {
    const s = allSeo?.[seoKey];
    if (s) return s;
    return { ...EMPTY_GALLERY_SEO, html: legacy };
  }, [allSeo, seoKey, legacy]);

  const [draft, setDraft] = useState<GallerySeoData>(stored);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(stored), [stored]);

  useEffect(() => {
    const el = bodyRef.current;
    if (editable && el && document.activeElement !== el && el.innerHTML !== draft.html) {
      el.innerHTML = draft.html;
    }
  }, [draft.html, editable]);

  const canonical = draft.canonical || `${SITE}${pathname}`;

  // Apply the CMS meta fields to <head> for this route.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (draft.seoTitle) document.title = draft.seoTitle;
    upsertMeta('meta[name="description"]', "name", "description", draft.metaDescription);
    upsertMeta('meta[name="keywords"]', "name", "keywords", draft.keywords);
    upsertMeta('meta[property="og:title"]', "property", "og:title", draft.ogTitle || draft.seoTitle);
    upsertMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      draft.ogDescription || draft.metaDescription,
    );
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [draft.seoTitle, draft.metaDescription, draft.keywords, draft.ogTitle, draft.ogDescription, canonical]);

  // Related galleries: shared category first, then shared tags, then any other.
  const related = useMemo(() => {
    const others = (galleries ?? []).filter((g) => g.slug !== slug);
    const tags = new Set(draft.tags.map((t) => t.toLowerCase()));
    const scored = others.map((g) => {
      const s = allSeo?.[g.slug];
      let score = 0;
      if (s?.category && draft.category && s.category.toLowerCase() === draft.category.toLowerCase())
        score += 3;
      for (const t of s?.tags ?? []) if (tags.has(t.toLowerCase())) score += 1;
      return { g, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.g);
  }, [galleries, allSeo, slug, draft.category, draft.tags]);

  const jsonLd = useMemo(() => {
    const heading = draft.seoTitle || `${title} — Point Studio`;
    const desc = draft.metaDescription || draft.description || "";
    const graph: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: heading,
        description: desc,
        url: canonical,
        inLanguage: lang === "ro" ? "ro-RO" : "en",
      },
      {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        name: `${title} gallery`,
        url: canonical,
        ...(images.length
          ? {
              image: images.slice(0, 20).map((img, i) => ({
                "@type": "ImageObject",
                contentUrl: img.src,
                description:
                  img.alt ||
                  (draft.altTemplate
                    ? draft.altTemplate.replace("{n}", String(i + 1))
                    : `${title} photography — frame ${i + 1}`),
              })),
            }
          : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: title, item: canonical },
        ],
      },
    ];
    if (draft.faqs.length) {
      graph.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: draft.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    return graph;
  }, [draft, title, canonical, images, lang]);

  const persist = async (next: GallerySeoData) => {
    setSaving(true);
    try {
      await saveSeo(slug, next);
      setDraft(next);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const html = sanitize(bodyRef.current?.innerHTML ?? draft.html).trim();
    await persist({ ...draft, html, manuallyEdited: true });
  };

  const generate = async () => {
    if (remaining <= 0) {
      alert(`Daily AI limit reached (${limit} generations per day).`);
      return;
    }
    if (
      draft.manuallyEdited &&
      !confirm(
        "This gallery has manual edits. Overwrite them with a fresh AI version? This uses 1 AI credit.",
      )
    )
      return;
    if (!draft.manuallyEdited && draft.html && !confirm("Regenerate the SEO content? Uses 1 AI credit."))
      return;
    setBusy(true);
    try {
      await consume();
      const out = await runAi({
        data: {
          gallerySlug: slug,
          galleryTitle: title,
          location: draft.location || location,
          current: draft.html || undefined,
          language: lang,
          category: draft.category || undefined,
          description: draft.description || undefined,
          tags: draft.tags.length ? draft.tags : undefined,
          relatedGalleries: (galleries ?? []).map((g) => g.title).slice(0, 20),
        },
      });
      const html = sanitize(out.html || "");
      if (!html) throw new Error("AI returned empty content.");
      const next: GallerySeoData = {
        ...draft,
        html,
        faqs: out.faqs?.length ? out.faqs : draft.faqs,
        seoTitle: out.seoTitle || draft.seoTitle,
        metaDescription: out.metaDescription || draft.metaDescription,
        ogTitle: out.ogTitle || draft.ogTitle,
        ogDescription: out.ogDescription || draft.ogDescription,
        altTemplate: out.altTemplate || draft.altTemplate,
        keywords: out.keywords || draft.keywords,
        manuallyEdited: false,
      };
      if (bodyRef.current) bodyRef.current.innerHTML = html;
      await persist(next);
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const cmd = (command: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const field = (label: string, key: keyof GallerySeoData, placeholder = "") => (
    <label className="flex flex-col gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
      {label}
      <input
        value={(draft[key] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value, manuallyEdited: true })}
        className="rounded border border-border bg-background px-2 py-1 text-sm normal-case tracking-normal text-foreground"
      />
    </label>
  );

  if (!editable && !draft.html && !draft.faqs.length) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="border-t border-border pt-10">
        {editable && (
          <div className="mb-6 space-y-3 rounded-md bg-muted/60 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => cmd("formatBlock", "H2")} className="rounded border border-border bg-background px-2 py-1">H2</button>
              <button type="button" onClick={() => cmd("formatBlock", "H3")} className="rounded border border-border bg-background px-2 py-1">H3</button>
              <button type="button" onClick={() => cmd("formatBlock", "P")} className="rounded border border-border bg-background px-2 py-1">P</button>
              <button type="button" onClick={() => cmd("bold")} className="rounded border border-border bg-background px-2 py-1 font-bold">B</button>
              <button type="button" onClick={() => cmd("italic")} className="rounded border border-border bg-background px-2 py-1 italic">I</button>
              <button type="button" onClick={() => cmd("insertUnorderedList")} className="rounded border border-border bg-background px-2 py-1">• List</button>
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                onClick={generate}
                disabled={busy || remaining <= 0}
                className="inline-flex items-center gap-1 rounded bg-foreground px-2 py-1 text-background disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : draft.html ? <RefreshCw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {draft.html ? "Regenerate with AI" : "Generate with AI"}
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1"
              >
                <Save className="h-3 w-3" />
                {saving ? "Saving…" : "Save"}
              </button>
              <span className="ml-auto text-muted-foreground">
                {remaining}/{limit} AI credits left today · {lang.toUpperCase()}
                {draft.manuallyEdited ? " · manual edits protected" : ""}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {field("SEO title", "seoTitle", `${title} — Point Studio`)}
              {field("Meta description", "metaDescription")}
              {field("Canonical URL", "canonical", `${SITE}${pathname}`)}
              {field("OG title", "ogTitle")}
              {field("OG description", "ogDescription")}
              {field("Image ALT template", "altTemplate", `${title} photography — {n}`)}
              {field("Category", "category")}
              {field("Location", "location", location)}
              {field("Keywords (comma separated)", "keywords")}
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Tags (comma separated)
                <input
                  value={draft.tags.join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      manuallyEdited: true,
                    })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-widest text-muted-foreground sm:col-span-2">
                Short description
                <textarea
                  value={draft.description}
                  rows={2}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value, manuallyEdited: true })}
                  className="rounded border border-border bg-background px-2 py-1 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">FAQs</span>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, faqs: [...draft.faqs, { q: "", a: "" }], manuallyEdited: true })}
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              {draft.faqs.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <input
                      value={f.q}
                      placeholder="Question"
                      onChange={(e) => {
                        const faqs = [...draft.faqs];
                        faqs[i] = { ...f, q: e.target.value };
                        setDraft({ ...draft, faqs, manuallyEdited: true });
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                    <textarea
                      value={f.a}
                      rows={2}
                      placeholder="Answer"
                      onChange={(e) => {
                        const faqs = [...draft.faqs];
                        faqs[i] = { ...f, a: e.target.value };
                        setDraft({ ...draft, faqs, manuallyEdited: true });
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, faqs: draft.faqs.filter((_, j) => j !== i), manuallyEdited: true })
                    }
                    className="self-start rounded border border-border bg-background p-1 text-destructive"
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {editable ? (
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write or generate the SEO article for this gallery…"
            className="prose prose-neutral min-h-32 max-w-none rounded-sm p-4 text-[15px] leading-relaxed outline outline-1 outline-dashed outline-blue-400/60 focus:outline-blue-500"
          />
        ) : (
          draft.html && (
            <article
              className="prose prose-neutral max-w-none text-[15px] leading-relaxed [&_h2]:mb-4 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:italic [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-widest [&_li]:mb-1 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitize(draft.html) }}
            />
          )
        )}

        {!editable && draft.faqs.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-widest">
              {lang === "ro" ? "Întrebări frecvente" : "Frequently asked questions"}
            </h3>
            <dl className="space-y-4 text-[15px] leading-relaxed">
              {draft.faqs.map((f, i) => (
                <div key={i}>
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="mt-1 text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {related.length > 0 && (
          <nav className="mt-10 border-t border-border pt-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-widest">
              {lang === "ro" ? "Galerii înrudite" : "Related galleries"}
            </h3>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link to={galleryPath(g.slug)} className="underline underline-offset-4 hover:no-underline">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}
