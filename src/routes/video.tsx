import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import fallbackVideos from "@/data/videos.json";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useAssetMeta, useInvalidateAssetMeta } from "@/hooks/use-asset-meta";
import { useSiteList } from "@/hooks/use-site-list";
import { useServerFn } from "@tanstack/react-start";
import { saveAssetMeta, generateAssetMeta } from "@/lib/asset-meta.functions";
import { uploadToR2 } from "@/lib/r2.functions";
import { derivePoster, DEFAULT_VIDEO_POSTER } from "@/lib/generate-video-poster";
import { MediaLibraryPicker } from "@/components/MediaLibraryPicker";
import { Sparkles, Loader2, Plus, Trash2, Images, Upload, GripVertical, ArrowUpDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type VideoItem = {
  title: string;
  poster: string;
  src: string;
  // Extended fields (optional for back-compat with existing saved data)
  videoUrl?: string;
  posterUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  /** Marks that the current poster was auto-generated (safe to overwrite). */
  posterAuto?: boolean;
};

function posterOf(v: VideoItem): string {
  return v.posterUrl || v.poster || "";
}

export const Route = createFileRoute("/video")({
  component: VideoPage,
  head: () => ({
    meta: [
      { title: "Video Production & Motion — Point Studio Bucharest" },
      {
        name: "description",
        content:
          "Commercial video production, motion and reels by Point Studio — Bucharest photo & video studio.",
      },
      { property: "og:title", content: "Video Production — Point Studio" },
      { property: "og:description", content: "Motion, reels and video productions by Point Studio." },
      { property: "og:image", content: cdn(fallbackVideos[0].poster, 1600) },
      { name: "twitter:image", content: cdn(fallbackVideos[0].poster, 1600) },
    ],
  }),
});

function detectEmbed(url: string): { kind: "youtube" | "vimeo" | "file"; id?: string } {
  if (!url) return { kind: "file" };
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { kind: "youtube", id: yt[1] };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "vimeo", id: vm[1] };
  return { kind: "file" };
}

function embedUrl(url: string): string | null {
  const d = detectEmbed(url);
  if (d.kind === "youtube") return `https://www.youtube.com/embed/${d.id}?autoplay=1&rel=0`;
  if (d.kind === "vimeo") return `https://player.vimeo.com/video/${d.id}?autoplay=1`;
  return null;
}

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

function VideoPage() {
  const [active, setActive] = useState<number | null>(null);
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const { data: metaMap = {} } = useAssetMeta();
  const { items: videos, save } = useSiteList<VideoItem>("videos", fallbackVideos as VideoItem[]);
  const editable = isAdmin && editMode;
  const [pickerFor, setPickerFor] = useState<
    | { kind: "poster"; index: number }
    | { kind: "video"; index: number }
    | null
  >(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const upload = useServerFn(uploadToR2);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ids = useMemo(() => videos.map((_, i) => `v-${i}`), [videos]);

  const uploadVideoFile = async (file: File, index: number) => {
    setUploadingFor(index);
    try {
      const dataBase64 = await fileToBase64(file);
      const { url } = await upload({
        data: {
          filename: file.name,
          contentType: file.type || "video/mp4",
          dataBase64,
          folder: "videos",
        },
      });
      const next = [...videos];
      next[index] = { ...next[index], src: url };
      await save(next);
    } catch (e) {
      alert("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploadingFor(null);
    }
  };

  const addVideo = () => save([...videos, { title: "New video", poster: "", src: "" }]);

  const removeVideo = async (i: number) => {
    if (!confirm("Delete this video?")) return;
    await save(videos.filter((_, idx) => idx !== i));
  };

  const generatePosterFor = async (item: VideoItem): Promise<Partial<VideoItem>> => {
    const url = item.videoUrl || item.src;
    if (!url) return {};
    try {
      const res = await derivePoster(url);
      const meta: Partial<VideoItem> = {
        duration: res.duration ?? item.duration,
        width: res.width ?? item.width,
        height: res.height ?? item.height,
        posterAuto: true,
      };
      if (res.needsUpload && res.blob) {
        // Convert blob → base64 and push to R2 as an image asset.
        const buf = new Uint8Array(await res.blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
        }
        const { url: posterUrl } = await upload({
          data: {
            filename: `poster-${Date.now()}.webp`,
            contentType: "image/webp",
            dataBase64: btoa(bin),
            kind: "image",
          },
        });
        return { ...meta, posterUrl, poster: posterUrl };
      }
      if (res.posterUrl) {
        return { ...meta, posterUrl: res.posterUrl, poster: res.posterUrl };
      }
      return { ...meta, posterUrl: DEFAULT_VIDEO_POSTER, poster: DEFAULT_VIDEO_POSTER };
    } catch (e) {
      console.error("Poster generation failed", e);
      return { posterUrl: DEFAULT_VIDEO_POSTER, poster: DEFAULT_VIDEO_POSTER, posterAuto: true };
    }
  };

  const updateVideo = async (i: number, patch: Partial<VideoItem>) => {
    const next = [...videos];
    const prev = next[i];
    const merged: VideoItem = { ...prev, ...patch };

    // Keep videoUrl <-> src in sync for back-compat.
    if (patch.src !== undefined) merged.videoUrl = patch.src;
    if (patch.videoUrl !== undefined) merged.src = patch.videoUrl;

    // Regenerate poster only when the video URL changes AND either no poster
    // is set or the existing poster was auto-generated (never overwrite a
    // custom poster the user pasted or picked).
    const newSrc = merged.videoUrl || merged.src;
    const prevSrc = prev.videoUrl || prev.src;
    const videoChanged = newSrc && newSrc !== prevSrc;
    const posterChangedByUser =
      patch.poster !== undefined || patch.posterUrl !== undefined;

    if (posterChangedByUser) {
      merged.posterUrl = patch.posterUrl ?? patch.poster ?? merged.posterUrl;
      merged.poster = patch.poster ?? patch.posterUrl ?? merged.poster;
      merged.posterAuto = false;
    } else if (videoChanged) {
      const hasCustom = (prev.posterUrl || prev.poster) && prev.posterAuto === false;
      if (!hasCustom) {
        const gen = await generatePosterFor(merged);
        Object.assign(merged, gen);
      }
    }

    next[i] = merged;
    try {
      await save(next);
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const regeneratePoster = async (i: number) => {
    const gen = await generatePosterFor(videos[i]);
    const next = [...videos];
    next[i] = { ...next[i], ...gen };
    await save(next);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const from = ids.indexOf(String(a.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    await save(arrayMove(videos, from, to));
  };

  const activeEmbed = active !== null ? embedUrl(videos[active]?.src || "") : null;

  const sortBy = async (mode: "title-asc" | "title-desc" | "reverse" | "shuffle") => {
    const metaLabel = (v: VideoItem) => (metaMap[v.poster]?.label || v.title || "").toLowerCase();
    let next = [...videos];
    if (mode === "title-asc") next.sort((a, b) => metaLabel(a).localeCompare(metaLabel(b)));
    else if (mode === "title-desc") next.sort((a, b) => metaLabel(b).localeCompare(metaLabel(a)));
    else if (mode === "reverse") next.reverse();
    else if (mode === "shuffle") next.sort(() => Math.random() - 0.5);
    await save(next);
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        {editable && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-neutral-500 uppercase tracking-widest">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
            </span>
            <button onClick={() => sortBy("title-asc")} className="px-2 py-1 border rounded hover:bg-neutral-100">Title A→Z</button>
            <button onClick={() => sortBy("title-desc")} className="px-2 py-1 border rounded hover:bg-neutral-100">Title Z→A</button>
            <button onClick={() => sortBy("reverse")} className="px-2 py-1 border rounded hover:bg-neutral-100">Reverse</button>
            <button onClick={() => sortBy("shuffle")} className="px-2 py-1 border rounded hover:bg-neutral-100">Shuffle</button>
            <span className="text-neutral-400">· or drag cards to reorder manually</span>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((v, i) => (
                <VideoCard
                  key={ids[i]}
                  id={ids[i]}
                  v={v}
                  index={i}
                  editable={editable}
                  meta={metaMap[posterOf(v)]}
                  onRegeneratePoster={() => regeneratePoster(i)}
                  uploading={uploadingFor === i}
                  onOpen={() => v.src && setActive(i)}
                  onDelete={() => removeVideo(i)}
                  onUpdate={(patch) => updateVideo(i, patch)}
                  onPickPoster={() => setPickerFor({ kind: "poster", index: i })}
                  onPickVideo={() => setPickerFor({ kind: "video", index: i })}
                  onUploadFile={(f) => uploadVideoFile(f, i)}
                />
              ))}
              {editable && (
                <button
                  onClick={addVideo}
                  className="aspect-video border-2 border-dashed border-neutral-300 rounded flex flex-col items-center justify-center gap-2 text-neutral-500 hover:bg-neutral-50"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-sm">Add video</span>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {active !== null && videos[active]?.src && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <button
            className="absolute top-4 right-6 text-white text-sm uppercase tracking-widest"
            onClick={() => setActive(null)}
          >
            Close
          </button>
          {activeEmbed ? (
            <iframe
              src={activeEmbed}
              className="w-[90vw] h-[calc(90vw*9/16)] max-h-[90vh] max-w-[calc(90vh*16/9)]"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              onClick={(e) => e.stopPropagation()}
              title="Video player"
            />
          ) : (
            <video
              src={videos[active].src}
              controls
              autoPlay
              className="max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      <MediaLibraryPicker
        open={!!pickerFor}
        kind={pickerFor?.kind === "video" ? "video" : "image"}
        onClose={() => setPickerFor(null)}
        onPick={(a) => {
          if (!pickerFor) return;
          if (pickerFor.kind === "poster") updateVideo(pickerFor.index, { poster: a.url });
          else if (pickerFor.kind === "video") updateVideo(pickerFor.index, { src: a.url });
        }}
      />
    </SiteLayout>
  );
}

function VideoCard({
  id,
  v,
  editable,
  meta,
  uploading,
  onOpen,
  onDelete,
  onUpdate,
  onPickPoster,
  onPickVideo,
  onUploadFile,
  onRegeneratePoster,
}: {
  id: string;
  v: VideoItem;
  index: number;
  editable: boolean;
  meta: { label?: string | null; alt?: string | null } | undefined;
  uploading: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<VideoItem>) => void;
  onPickPoster: () => void;
  onPickVideo: () => void;
  onUploadFile: (f: File) => void;
  onRegeneratePoster: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const label = meta?.label || v.title;
  const alt = meta?.alt || v.title;
  const embed = detectEmbed(v.src);
  const poster = posterOf(v) || DEFAULT_VIDEO_POSTER;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-2">
      <div className="relative">
        <button
          onClick={onOpen}
          className="group relative aspect-video overflow-hidden bg-neutral-900 text-left w-full"
        >
          <img
            src={cdn(poster, 1400)}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 transition"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_VIDEO_POSTER;
            }}
          />

          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center text-black text-2xl">
              ▶
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <div className="font-serif text-2xl">{label}</div>
            {!v.src && (
              <div className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                Coming soon
              </div>
            )}
            {v.src && embed.kind !== "file" && (
              <div className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                {embed.kind}
              </div>
            )}
          </div>
        </button>
        {editable && (
          <>
            <button
              {...attributes}
              {...listeners}
              className="absolute top-2 left-2 p-2 bg-black/60 text-white rounded shadow-lg cursor-grab active:cursor-grabbing z-10"
              aria-label="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded shadow-lg hover:bg-red-600 z-10"
              aria-label="Delete video"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {editable && (
        <VideoFieldsEditor
          key={`${v.title}|${posterOf(v)}|${v.src}`}
          v={v}
          uploading={uploading}
          onUpdate={onUpdate}
          onPickPoster={onPickPoster}
          onPickVideo={onPickVideo}
          onUploadFile={onUploadFile}
          onRegeneratePoster={onRegeneratePoster}
        />
      )}
    </div>
  );
}

function VideoFieldsEditor({
  v,
  uploading,
  onUpdate,
  onPickPoster,
  onPickVideo,
  onUploadFile,
}: {
  v: VideoItem;
  uploading: boolean;
  onUpdate: (patch: Partial<VideoItem>) => void;
  onPickPoster: () => void;
  onPickVideo: () => void;
  onUploadFile: (f: File) => void;
}) {
  const [title, setTitle] = useState(v.title);
  const [poster, setPoster] = useState(v.poster);
  const [src, setSrc] = useState(v.src);

  const dirty = title !== v.title || poster !== v.poster || src !== v.src;

  const saveAll = () => {
    const patch: Partial<VideoItem> = {};
    if (title !== v.title) patch.title = title;
    if (poster !== v.poster) patch.poster = poster;
    if (src !== v.src) patch.src = src;
    if (Object.keys(patch).length) onUpdate(patch);
  };

  return (
    <div className="bg-white border border-blue-400/60 border-dashed rounded p-2 flex flex-col gap-2 text-xs">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="border rounded px-2 py-1"
      />
      <div className="flex gap-1.5 items-center">
        <span className="text-neutral-500 w-12 shrink-0">Poster:</span>
        <input
          value={poster}
          onChange={(e) => setPoster(e.target.value)}
          placeholder="Poster URL"
          className="border rounded px-2 py-1 flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={onPickPoster}
          className="p-1.5 border rounded hover:bg-neutral-100"
          title="Pick from library"
        >
          <Images className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-1.5 items-center">
        <span className="text-neutral-500 w-12 shrink-0">Video:</span>
        <input
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          placeholder="YouTube / Vimeo link or MP4 URL"
          className="border rounded px-2 py-1 flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={onPickVideo}
          className="p-1.5 border rounded hover:bg-neutral-100"
          title="Pick from library"
        >
          <Images className="w-3.5 h-3.5" />
        </button>
        <label
          className="p-1.5 border rounded hover:bg-neutral-100 cursor-pointer"
          title="Upload video file"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={saveAll}
        disabled={!dirty}
        className="px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {dirty ? "Save changes" : "Saved"}
      </button>
      <VideoMetaEditor url={v.poster} initialLabel={v.title} initialAlt={v.title} />
    </div>
  );
}

function VideoMetaEditor({
  url,
  initialLabel,
  initialAlt,
}: {
  url: string;
  initialLabel: string;
  initialAlt: string;
}) {
  const save = useServerFn(saveAssetMeta);
  const generate = useServerFn(generateAssetMeta);
  const invalidate = useInvalidateAssetMeta();
  const [label, setLabel] = useState(initialLabel);
  const [alt, setAlt] = useState(initialAlt);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const doSave = async (patch?: { label?: string; alt?: string; caption?: string }) => {
    if (!url) return;
    setSaving(true);
    try {
      await save({
        data: {
          url,
          label: (patch?.label ?? label) || null,
          alt: (patch?.alt ?? alt) || null,
          caption: (patch?.caption ?? caption) || null,
        },
      });
      invalidate();
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const doAi = async () => {
    if (!url) return;
    setAiBusy(true);
    try {
      const out = (await generate({
        data: { imageUrl: url, context: "Video showreel poster", kind: "image" },
      })) as { label?: string; alt?: string; caption?: string };
      if (out.label) setLabel(out.label);
      if (out.alt) setAlt(out.alt);
      if (out.caption) setCaption(out.caption);
      await doSave({ label: out.label, alt: out.alt, caption: out.caption });
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 border-t pt-1.5 mt-1">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => doSave()}
        placeholder="Label (shown on card)"
        className="border rounded px-2 py-1"
      />
      <textarea
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => doSave()}
        rows={2}
        placeholder="Alt text"
        className="border rounded px-2 py-1 resize-y"
      />
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={() => doSave()}
        rows={2}
        placeholder="Caption / description"
        className="border rounded px-2 py-1 resize-y"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doAi}
          disabled={aiBusy || saving || !url}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI write all
        </button>
        {saving && <span className="text-[10px] text-neutral-500 self-center">Saving…</span>}
      </div>
    </div>
  );
}
