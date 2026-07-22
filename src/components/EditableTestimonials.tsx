import { useRef, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useSiteList } from "@/hooks/use-site-list";
import { supabase } from "@/integrations/supabase/client";
import { cdn } from "./SiteLayout";
import { Play, X, Plus, Loader2, Upload } from "lucide-react";

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

export function EditableTestimonials({ fallback }: { fallback: Testimonial[] }) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;
  const { items, save } = useSiteList<Testimonial>("testimonials", fallback);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

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

  // Responsive columns based on count so cards stay balanced when adding/removing
  const cols =
    items.length <= 1
      ? "grid-cols-1"
      : items.length === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : items.length === 3
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <>
      <div className={`grid ${cols} gap-5 md:gap-6`}>
        {items.map((t) => (
          <TestimonialCard
            key={t.id}
            t={t}
            editable={editable}
            onPlay={() => t.video && setActiveVideo(t.video)}
            onChange={(p) => update(t.id, p)}
            onRemove={() => remove(t.id)}
          />
        ))}
        {editable && (
          <div className="flex flex-col gap-2 border-2 border-dashed border-border rounded p-6 items-center justify-center text-muted-foreground min-h-[220px]">
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
        )}
      </div>

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

  const uploadPoster = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) return alert("Invalid image");
    if (file.size > MAX_SIZE) return alert("Max 20 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `testimonials/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file, {
        contentType: file.type,
      });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(path);
      await onChange({ poster: publicUrl });
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <figure className="relative bg-background flex flex-col overflow-hidden">
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
          <span className="font-serif italic text-3xl md:text-4xl leading-none text-foreground/30">"</span>
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
