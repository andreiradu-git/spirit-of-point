import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useSiteList } from "@/hooks/use-site-list";
import { useServerFn } from "@tanstack/react-start";
import { uploadToR2 } from "@/lib/r2.functions";
import { cdn } from "./SiteLayout";
import { Play, X, Plus, Loader2, Upload, ChevronLeft, ChevronRight, Pause } from "lucide-react";

export type Testimonial = {
  id: string;
  kind: "text" | "video";
  quote?: string;
  name: string;
  role: string;
  video?: string;
  poster?: string;
};

const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUTOPLAY_MS = 5000;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

export function EditableTestimonials({ fallback }: { fallback: Testimonial[] }) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;
  const { items, save } = useSiteList<Testimonial>("testimonials", fallback);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: items.length > 1,
    align: "start",
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    const onInit = () => setSnapCount(emblaApi.scrollSnapList().length);
    onInit();
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", () => {
      onInit();
      onSelect();
    });
  }, [emblaApi, items.length]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi || !playing || editable || activeVideo || items.length <= 1) return;
    timer.current = setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [emblaApi, playing, editable, activeVideo, items.length]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  const update = async (id: string, patch: Partial<Testimonial>) => {
    await save(items.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const remove = async (id: string) => {
    if (!confirm("Remove this testimonial?")) return;
    await save(items.filter((t) => t.id !== id));
  };
  const add = async (kind: "text" | "video") => {
    const next: Testimonial =
      kind === "text"
        ? { id: crypto.randomUUID(), kind, name: "Name", role: "Role", quote: "Your testimonial here." }
        : { id: crypto.randomUUID(), kind, name: "Name", role: "Role", video: "" };
    await save([...items, next]);
  };

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setPlaying(false)}
        onMouseLeave={() => setPlaying(true)}
      >
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {items.map((t) => (
              <div
                key={t.id}
                className="shrink-0 grow-0 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 min-w-0 pl-4 first:pl-0"
              >
                <TestimonialCard
                  t={t}
                  editable={editable}
                  onPlay={() => t.video && setActiveVideo(t.video)}
                  onChange={(p) => update(t.id, p)}
                  onRemove={() => remove(t.id)}
                />
              </div>
            ))}
            {editable && (
              <div className="shrink-0 grow-0 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 min-w-0 pl-4 first:pl-0">
                <div className="flex flex-col gap-2 border-2 border-dashed border-border rounded p-6 items-center justify-center text-muted-foreground min-h-[280px] h-full">
                  <span className="text-xs uppercase tracking-widest">Add testimonial</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => add("text")}
                      className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Text
                    </button>
                    <button
                      type="button"
                      onClick={() => add("video")}
                      className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Video
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-black" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-black" />
            </button>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause autoplay" : "Play autoplay"}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: snapCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === selected ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25 hover:bg-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <button
            type="button"
            onClick={() => setActiveVideo(null)}
            className="absolute top-6 right-6 text-white/80 hover:text-white"
            aria-label="Close video"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full max-w-5xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={activeVideo + (activeVideo.includes("?") ? "&" : "?") + "autoplay=1"}
              title="Video testimonial"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
}

function TestimonialCard({
  t,
  editable,
  onPlay,
  onChange,
  onRemove,
}: {
  t: Testimonial;
  editable: boolean;
  onPlay: () => void;
  onChange: (patch: Partial<Testimonial>) => void;
  onRemove: () => void;
}) {
  const posterInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = useServerFn(uploadToR2);

  const uploadPoster = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) return alert("Invalid image");
    if (file.size > MAX_SIZE) return alert("Max 20 MB");
    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const { url } = await upload({
        data: {
          filename: file.name,
          contentType: file.type,
          dataBase64,
          folder: "testimonials",
        },
      });
      await onChange({ poster: url });
    } catch (e) {
      console.error(e);
      alert("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <figure className="relative bg-background flex flex-col overflow-hidden h-full min-h-[280px]">
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 z-20 p-1.5 bg-red-500 text-white rounded"
          aria-label="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {t.kind === "video" ? (
        <div className="relative aspect-[4/3] w-full group overflow-hidden bg-muted">
          {t.poster && (
            <img
              src={cdn(t.poster, 1200)}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
          {t.video && !editable && (
            <button
              type="button"
              onClick={onPlay}
              className="absolute inset-0 flex items-center justify-center"
              aria-label={`Play video from ${t.name}`}
            >
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 md:w-6 md:h-6 text-black fill-black translate-x-0.5" />
              </div>
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => posterInput.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs uppercase tracking-widest gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Change poster
            </button>
          )}
          <input
            ref={posterInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPoster(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="p-5 md:p-6 flex flex-col gap-4 flex-1">
          <span className="font-serif italic text-3xl md:text-4xl leading-none text-foreground/30">&ldquo;</span>
          {editable ? (
            <textarea
              defaultValue={t.quote ?? ""}
              onBlur={(e) => onChange({ quote: e.target.value })}
              rows={5}
              className="font-serif italic text-base md:text-lg leading-snug text-foreground/85 bg-transparent border border-dashed border-blue-400/60 rounded p-2 focus:outline-blue-500"
            />
          ) : (
            <blockquote className="font-serif italic text-base md:text-lg leading-snug text-foreground/85">
              {t.quote}
            </blockquote>
          )}
        </div>
      )}

      <figcaption className="p-5 md:p-6 pt-4 mt-auto space-y-1">
        {editable ? (
          <>
            <input
              defaultValue={t.name}
              onBlur={(e) => onChange({ name: e.target.value })}
              placeholder="Name"
              className="w-full text-sm font-medium text-foreground bg-transparent border border-dashed border-blue-400/60 rounded px-2 py-1"
            />
            <input
              defaultValue={t.role}
              onBlur={(e) => onChange({ role: e.target.value })}
              placeholder="Role"
              className="w-full text-[11px] uppercase tracking-[0.18em] text-muted-foreground bg-transparent border border-dashed border-blue-400/60 rounded px-2 py-1"
            />
            {t.kind === "video" && (
              <input
                defaultValue={t.video ?? ""}
                onBlur={(e) => onChange({ video: e.target.value })}
                placeholder="Video embed URL (e.g. https://www.youtube.com/embed/…)"
                className="w-full text-[11px] text-foreground bg-transparent border border-dashed border-blue-400/60 rounded px-2 py-1"
              />
            )}
          </>
        ) : (
          <>
            <div className="text-sm font-medium text-foreground">{t.name}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.role}</div>
          </>
        )}
      </figcaption>
    </figure>
  );
}
