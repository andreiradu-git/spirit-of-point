import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAdmin } from "@/hooks/use-admin";
import { uploadToR2 } from "@/lib/r2.functions";
import { MediaLibraryPicker } from "@/components/MediaLibraryPicker";
import { cdn } from "@/components/SiteLayout";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Trash2, Upload, Images, RefreshCw } from "lucide-react";
import {
  useHeroItems,
  useHeroSettings,
  useSaveHeroGallery,
  isVideoUrl,
  DEFAULT_HERO_SETTINGS,
  type HeroItem,
  type HeroSettings,
} from "@/hooks/use-hero-gallery";

export const Route = createFileRoute("/admin/hero")({
  component: AdminHero,
  head: () => ({
    meta: [
      { title: "Hero Gallery — Point Studio CMS" },
      { name: "description", content: "Manage the Point Studio homepage hero carousel: media, order, alt text, captions and display mode." },
      { property: "og:title", content: "Hero Gallery — Point Studio CMS" },
      { property: "og:description", content: "Manage the homepage hero carousel media and display settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function newId() {
  return `hero-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

function Row({
  item,
  onChange,
  onRemove,
  onReplace,
}: {
  item: HeroItem;
  onChange: (patch: Partial<HeroItem>) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-4 items-start border rounded p-3 bg-white ${isDragging ? "opacity-60" : ""}`}
    >
      <button {...attributes} {...listeners} className="mt-1 p-1 cursor-grab active:cursor-grabbing text-neutral-400">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-28 h-20 bg-neutral-100 shrink-0 overflow-hidden flex items-center justify-center">
        {item.kind === "image" || item.poster ? (
          <img src={cdn(item.poster || item.src, 300)} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-neutral-500 px-1 break-all text-center">{item.src}</span>
        )}
      </div>
      <div className="flex-1 grid gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="uppercase tracking-widest text-neutral-500">{item.kind}</span>
          <span className="truncate text-neutral-400">{item.src}</span>
        </div>
        <input
          value={item.alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Alt text"
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          value={item.caption ?? ""}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Caption (optional)"
          className="border rounded px-2 py-1 text-sm"
        />
        {item.kind === "video" && (
          <input
            value={item.poster ?? ""}
            onChange={(e) => onChange({ poster: e.target.value })}
            placeholder="Poster image URL (optional)"
            className="border rounded px-2 py-1 text-sm"
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onReplace} className="text-xs border rounded px-2 py-1 hover:bg-neutral-50 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Replace
        </button>
        <button onClick={onRemove} className="text-xs border border-red-300 text-red-600 rounded px-2 py-1 hover:bg-red-50 flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );
}

function AdminHero() {
  const { isAdmin, loading } = useAdmin();
  const { data: storedItems } = useHeroItems();
  const { data: storedSettings } = useHeroSettings();
  const { saveItems, saveSettings } = useSaveHeroGallery();
  const upload = useServerFn(uploadToR2);

  const [items, setItems] = useState<HeroItem[]>([]);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [picker, setPicker] = useState<null | { replaceId?: string }>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => {
    if (storedItems) setItems(storedItems);
  }, [storedItems]);
  useEffect(() => {
    if (storedSettings) setSettings(storedSettings);
  }, [storedSettings]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const persist = async (next: HeroItem[]) => {
    setItems(next);
    await saveItems(next);
    setStatus("Saved");
    window.setTimeout(() => setStatus(""), 1500);
  };

  const addUrl = async (url: string, replaceId?: string | null) => {
    const kind = isVideoUrl(url) ? "video" : "image";
    if (replaceId) {
      await persist(items.map((it) => (it.id === replaceId ? { ...it, src: url, kind } : it)));
    } else {
      await persist([...items, { id: newId(), kind, src: url, alt: "", caption: "" }]);
    }
  };

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const replaceId = replaceTarget.current;
      replaceTarget.current = null;
      let next = items;
      for (const file of Array.from(files)) {
        const kind = file.type.startsWith("video/") ? "video" : "image";
        const dataBase64 = await fileToBase64(file);
        const res = await upload({ data: { filename: file.name, contentType: file.type, dataBase64, kind } });
        if (replaceId) {
          next = next.map((it) => (it.id === replaceId ? { ...it, src: res.url, kind } : it));
        } else {
          next = [...next, { id: newId(), kind, src: res.url, alt: "", caption: "" }];
        }
      }
      await persist(next);
    } catch (e) {
      alert("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    await persist(arrayMove(items, from, to));
  };

  if (loading) return <div className="p-10 text-sm text-neutral-500">Loading…</div>;
  if (!isAdmin) return <div className="p-10 text-sm">Admin access required.</div>;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold mb-1">Hero Gallery</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Images and videos shown in the homepage hero carousel. Media is stored on Cloudflare R2.
        </p>

        <div className="bg-white border rounded p-4 mb-6 grid gap-4">
          <div>
            <div className="text-sm font-medium mb-2">Display mode</div>
            <div className="flex flex-wrap gap-2">
              {([
                ["static", "Static (first item)"],
                ["click", "Change on click"],
                ["auto", "Auto rotate"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={async () => {
                    const next = { ...settings, mode: value };
                    setSettings(next);
                    await saveSettings(next);
                  }}
                  className={`text-sm px-3 py-1.5 border rounded ${
                    settings.mode === value ? "bg-black text-white border-black" : "hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {settings.mode === "auto" && (
            <div>
              <div className="text-sm font-medium mb-2">Rotation interval</div>
              <div className="flex gap-2">
                {([2, 3, 4, 5] as const).map((s) => (
                  <button
                    key={s}
                    onClick={async () => {
                      const next = { ...settings, interval: s };
                      setSettings(next);
                      await saveSettings(next);
                    }}
                    className={`text-sm px-3 py-1.5 border rounded ${
                      settings.interval === s ? "bg-black text-white border-black" : "hover:bg-neutral-50"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => {
              replaceTarget.current = null;
              fileRef.current?.click();
            }}
            disabled={busy}
            className="text-sm px-3 py-1.5 bg-black text-white rounded flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload media
          </button>
          <button
            onClick={() => setPicker({})}
            className="text-sm px-3 py-1.5 border rounded flex items-center gap-2 hover:bg-neutral-50"
          >
            <Images className="w-4 h-4" /> Pick from library
          </button>
          <div className="flex gap-2 flex-1 min-w-[240px]">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Or paste an image / video URL (YouTube, Vimeo, MP4)"
              className="flex-1 border rounded px-2 py-1.5 text-sm"
            />
            <button
              onClick={async () => {
                if (!urlInput.trim()) return;
                await addUrl(urlInput.trim());
                setUrlInput("");
              }}
              className="text-sm px-3 py-1.5 border rounded hover:bg-neutral-50"
            >
              Add
            </button>
          </div>
          {status && <span className="text-xs text-green-600">{status}</span>}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {items.length === 0 ? (
          <div className="text-sm text-neutral-500 border rounded bg-white p-8 text-center">
            No hero media yet — the homepage falls back to the current hero image.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3">
                {items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    onChange={(patch) => {
                      const next = items.map((i) => (i.id === item.id ? { ...i, ...patch } : i));
                      setItems(next);
                      void saveItems(next);
                    }}
                    onRemove={() => {
                      if (!confirm("Remove this item from the hero carousel?")) return;
                      void persist(items.filter((i) => i.id !== item.id));
                    }}
                    onReplace={() => {
                      replaceTarget.current = item.id;
                      fileRef.current?.click();
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <MediaLibraryPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        onPick={(asset) => {
          void addUrl(asset.url, picker?.replaceId ?? null);
          setPicker(null);
        }}
      />
    </div>
  );
}
