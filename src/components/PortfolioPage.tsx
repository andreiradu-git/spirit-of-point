import { useRef, useState, useEffect } from "react";
import { SiteLayout, cdn } from "./SiteLayout";
import { EditableGallery } from "./EditableGallery";
import { EditableLogoBand } from "./EditableLogoBand";
import { useGallery, useInvalidateGalleries } from "@/hooks/use-gallery";
import { Editable } from "./Editable";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useServerFn } from "@tanstack/react-start";
import { updateGalleryMeta } from "@/lib/media.functions";
import { generateGalleryPageCopy } from "@/lib/text-ai.functions";
import { useAiLanguage } from "@/hooks/use-ai-language";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type Img = { src: string; alt?: string };

export function PortfolioPage({
  slug,
  tagline,
  taglineId,
  fallbackImages,
  showStrip = false,
  showLogos = false,
  galleryLayout = "masonry",
}: {
  slug: string;
  tagline: string;
  taglineId?: string;
  fallbackImages: Img[];
  showStrip?: boolean;
  showLogos?: boolean;
  galleryLayout?: "grid" | "masonry" | "stacked";
}) {
  const { data: gallery } = useGallery(slug);
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const invalidateAll = useInvalidateGalleries();
  const saveMeta = useServerFn(updateGalleryMeta);
  const genCopy = useServerFn(generateGalleryPageCopy);
  const { lang: aiLang, setLang: setAiLang } = useAiLanguage();

  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  // Sync DB values into local state when gallery loads
  useEffect(() => {
    if (gallery) {
      setSubtitle(gallery.subtitle ?? "");
      setDescription(gallery.description ?? "");
    }
  }, [gallery?.id]);

  const images: Img[] =
    gallery?.images.map((img) => ({ src: img.src, alt: img.alt ?? undefined })) ??
    fallbackImages.filter((i) => !/LOGO_PSP/i.test(i.src));

  const stripRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const doSave = async () => {
    if (!gallery?.id) return;
    setSaving(true);
    try {
      await saveMeta({ data: { id: gallery.id, subtitle: subtitle || null, description: description || null } });
      invalidateAll();
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const doAi = async (instruction?: string) => {
    setAiBusy(true);
    try {
      const out = await genCopy({
        data: {
          galleryTitle: gallery?.title ?? tagline,
          gallerySlug: slug,
          existingDescription: description || undefined,
          instruction,
          language: aiLang,
        },
      });
      if (!description || confirm("Replace existing description with AI-generated content?")) {
        if (out.subtitle) setSubtitle(out.subtitle);
        if (out.description) setDescription(out.description);
        if (gallery?.id && (out.seo_title || out.meta_description)) {
          await saveMeta({
            data: {
              id: gallery.id,
              subtitle: out.subtitle || subtitle || null,
              description: out.description || description || null,
              seo_title: out.seo_title || null,
              meta_description: out.meta_description || null,
            },
          });
          invalidateAll();
        }
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  const editable = isAdmin && editMode;
  const hasDescription = description.trim().length > 0 || subtitle.trim().length > 0;

  return (
    <SiteLayout>
      <div className="pt-10 md:pt-14 pb-10 md:pb-16">
        <p className="text-center text-[11px] md:text-xs uppercase tracking-[0.35em] md:tracking-[0.5em] text-foreground/70 px-4">
          {taglineId ? (
            <Editable id={taglineId} className="inline">
              {tagline}
            </Editable>
          ) : (
            tagline
          )}
        </p>
      </div>

      {showStrip && (
        <section className="relative bg-background">
          <div
            ref={stripRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-6 pb-6"
            style={{ scrollbarWidth: "thin" }}
          >
            {images.map((img) => (
              <div
                key={"strip-" + img.src}
                className="shrink-0 snap-start h-[41vh] md:h-[52vh] bg-muted"
              >
                <img
                  src={cdn(img.src, 1200)}
                  alt={img.alt || "Point Studio photograph"}
                  loading="lazy"
                  className="h-full w-auto object-cover"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Previous"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ‹
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Next"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-2xl shadow hover:bg-white"
          >
            ›
          </button>
        </section>
      )}

      {showLogos && <EditableLogoBand />}

      {/* Full gallery */}
      {galleryLayout === "stacked" ? (
        <div className="w-full pt-6 md:pt-10 pb-24">
          <EditableGallery
            slug={slug}
            fallbackImages={fallbackImages}
            layout="stacked"
            lightbox
          />
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-6 pt-10 md:pt-14 pb-16">
          <EditableGallery
            slug={slug}
            fallbackImages={fallbackImages}
            aspect="auto"
            layout="masonry"
            lightbox
          />
        </div>
      )}

      {/* Description section — shown below gallery */}
      {(hasDescription || editable) && (
        <section className="bg-[#f5f5f5] border-t border-neutral-200">
          <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
            {editable ? (
              <>
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">About this category</p>
                  <div className="flex gap-2">
                    <select
                      className="text-xs border rounded px-2 py-1"
                      title="AI language"
                      onChange={(e) => setAiLang(e.target.value as "en" | "ro")}
                      value={aiLang}
                    >
                      <option value="en">EN</option>
                      <option value="ro">RO</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => doAi()}
                      disabled={aiBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-black text-white text-xs hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate with AI
                    </button>
                    <button
                      type="button"
                      onClick={doSave}
                      disabled={saving || aiBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded border text-xs hover:bg-neutral-100 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Subtitle (short evocative line)"
                  className="w-full border rounded px-3 py-2 text-sm mb-3 font-serif italic"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description — write about this category's style, subjects, mood…"
                  rows={8}
                  className="w-full border rounded px-3 py-2 text-sm resize-y leading-relaxed"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  This text appears below the gallery on the category page and is used for SEO.
                </p>
              </>
            ) : (
              <>
                {subtitle && (
                  <p className="font-serif italic text-xl md:text-2xl text-foreground/80 mb-5">{subtitle}</p>
                )}
                {description && (
                  <>
                    <div
                      className={`prose prose-sm max-w-none text-foreground/70 leading-relaxed whitespace-pre-line ${!descOpen && description.length > 600 ? "line-clamp-4" : ""}`}
                    >
                      {description}
                    </div>
                    {description.length > 600 && (
                      <button
                        type="button"
                        onClick={() => setDescOpen((v) => !v)}
                        className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-foreground/60 hover:text-foreground"
                      >
                        {descOpen ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read more</>}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </SiteLayout>
  );
}
