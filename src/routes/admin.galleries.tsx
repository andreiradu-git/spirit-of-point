import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useServerFn } from "@tanstack/react-start";
import {
  addGalleryImage,
  deleteGallery,
  getGalleries,
  moveGalleryImage,
  removeGalleryImage,
  reorderGalleries,
  setGalleryCoverImage,
  upsertGallery,
} from "@/lib/media.functions";
import { generateGalleryDescription } from "@/lib/text-ai.functions";
import { uploadToR2 } from "@/lib/r2.functions";
import { useAiLanguage } from "@/hooks/use-ai-language";
import { useInvalidateGalleries } from "@/hooks/use-galleries";
import { cdn } from "@/components/SiteLayout";
import { useQuery } from "@tanstack/react-query";
import { useDraggable, useDroppable, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";

export const Route = createFileRoute("/admin/galleries")({
  component: AdminGalleriesPage,
  head: () => ({ meta: [{ title: "Galleries — Admin CMS" }, { name: "robots", content: "noindex" }] }),
});

type GalleryImage = {
  id: string;
  src: string;
  title: string | null;
  alt: string | null;
  gallery_id: string;
  position: number;
};

type GalleryRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  short_description: string | null;
  description_html: string | null;
  seo_title: string | null;
  meta_description: string | null;
  cover_image_id: string | null;
  visible: boolean;
  is_service: boolean;
  position: number;
  gallery_images: GalleryImage[];
};

function sanitizeHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function ImageDraggable({
  image,
  isCover,
  onSetCover,
  onRemove,
}: {
  image: GalleryImage;
  isCover: boolean;
  onSetCover: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `image:${image.id}:${image.gallery_id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className="rounded border bg-white overflow-hidden"
    >
      <img src={cdn(image.src, 320)} alt={image.alt ?? ""} className="w-full h-24 object-cover" />
      <div className="p-2 space-y-1">
        <div className="text-[11px] truncate">{image.title || "Untitled image"}</div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={onSetCover}
            className={`text-[10px] px-2 py-0.5 rounded border ${isCover ? "bg-black text-white border-black" : "hover:bg-neutral-50"}`}
          >
            {isCover ? "Cover" : "Set as Cover"}
          </button>
          <button type="button" onClick={onRemove} className="text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-600 hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const exec = (cmd: string) => {
    document.execCommand(cmd);
    onChange(ref.current?.innerHTML ?? "");
  };

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  return (
    <div className="border rounded">
      <div className="flex gap-1 border-b p-1 bg-neutral-50">
        <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => exec("bold")}>B</button>
        <button type="button" className="text-xs px-2 py-1 border rounded italic" onClick={() => exec("italic")}>I</button>
        <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => exec("insertUnorderedList")}>• List</button>
        <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => exec("insertOrderedList")}>1. List</button>
      </div>
      <div
        ref={ref}
        contentEditable
        className="min-h-28 p-3 text-sm outline-none"
        onBlur={() => onChange(ref.current?.innerHTML ?? "")}
      />
    </div>
  );
}

function GalleryDropZone({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `gallery:${id}` });
  return (
    <div ref={setNodeRef} className={isOver ? "ring-2 ring-black rounded" : ""}>
      {children}
    </div>
  );
}

function SortableGallery({
  gallery,
  children,
}: {
  gallery: GalleryRow;
  children: ReactNode;
}) {
  const { setNodeRef, transform, transition, attributes, listeners } = useSortable({ id: gallery.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="bg-white border rounded-lg p-4">
      <div className="mb-3">
        <button type="button" {...attributes} {...listeners} className="text-xs px-2 py-1 border rounded hover:bg-neutral-50">
          Drag to reorder gallery
        </button>
      </div>
      {children}
    </div>
  );
}

function AdminGalleriesPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const invalidate = useInvalidateGalleries();
  const { lang: aiLang } = useAiLanguage();
  const fetchAll = useServerFn(getGalleries);
  const saveGallery = useServerFn(upsertGallery);
  const removeGallery = useServerFn(deleteGallery);
  const saveGalleryOrder = useServerFn(reorderGalleries);
  const moveImage = useServerFn(moveGalleryImage);
  const setCover = useServerFn(setGalleryCoverImage);
  const removeImage = useServerFn(removeGalleryImage);
  const addImage = useServerFn(addGalleryImage);
  const runAi = useServerFn(generateGalleryDescription);
  const upload = useServerFn(uploadToR2);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin", "galleries"],
    queryFn: async () => (await fetchAll()) as GalleryRow[],
    enabled: !!isAdmin,
  });

  const [drafts, setDrafts] = useState<Record<string, GalleryRow>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<Record<string, "generate" | "rewrite" | "expand" | "shorten" | "seo">>({});

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (!data) return;
    const map: Record<string, GalleryRow> = {};
    data.forEach((g) => {
      map[g.id] = g;
    });
    setDrafts(map);
  }, [data]);

  const galleries = useMemo(
    () => Object.values(drafts).sort((a, b) => a.position - b.position),
    [drafts],
  );

  const updateDraft = (id: string, patch: Partial<GalleryRow>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const saveOne = async (g: GalleryRow) => {
    setBusyId(g.id);
    try {
      await saveGallery({
        data: {
          id: g.id,
          slug: g.slug,
          title: g.title,
          subtitle: g.subtitle,
          shortDescription: g.short_description,
          descriptionHtml: sanitizeHtml(g.description_html ?? ""),
          seoTitle: g.seo_title,
          metaDescription: g.meta_description,
          visible: g.visible,
          isService: g.is_service,
        },
      });
      await refetch();
      invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const onGallerySortEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (String(active.id).startsWith("image:") && String(over.id).startsWith("gallery:")) {
      const [_, imageId, fromGallery] = String(active.id).split(":");
      const targetGallery = String(over.id).split(":")[1];
      if (imageId && fromGallery && targetGallery && fromGallery !== targetGallery) {
        await moveImage({ data: { imageId, toGalleryId: targetGallery } });
        await refetch();
        invalidate();
        return;
      }
    }
    if (active.id === over.id) return;
    const from = galleries.findIndex((g) => g.id === active.id);
    const to = galleries.findIndex((g) => g.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(galleries, from, to).map((g, i) => ({ ...g, position: i + 1 }));
    const map: Record<string, GalleryRow> = {};
    next.forEach((g) => {
      map[g.id] = g;
    });
    setDrafts(map);
    await saveGalleryOrder({ data: { galleryIds: next.map((g) => g.id) } });
    invalidate();
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif">Gallery & Service CMS</h1>
            <p className="text-sm text-neutral-600">Create, reorder, hide, and manage service/category galleries.</p>
          </div>
          <Link to="/" className="text-sm underline">Open site</Link>
        </div>

        <div className="bg-white border rounded-lg p-4 mb-6 grid md:grid-cols-[1fr_1fr_auto] gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New gallery title" className="border rounded px-3 py-2 text-sm" />
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="Slug (optional)" className="border rounded px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={async () => {
              if (!newTitle.trim()) return;
              await saveGallery({ data: { title: newTitle.trim(), slug: newSlug.trim() || undefined } });
              setNewTitle("");
              setNewSlug("");
              await refetch();
              invalidate();
            }}
            className="px-4 py-2 text-sm bg-black text-white rounded"
          >
            Create gallery
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-neutral-500">Loading…</div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onGallerySortEnd}>
            <SortableContext items={galleries.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {galleries.map((g) => (
                  <SortableGallery key={g.id} gallery={g}>
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="text-sm">
                        Title
                        <input value={g.title} onChange={(e) => updateDraft(g.id, { title: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <label className="text-sm">
                        Slug
                        <input value={g.slug} onChange={(e) => updateDraft(g.id, { slug: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <label className="text-sm">
                        Subtitle
                        <input value={g.subtitle ?? ""} onChange={(e) => updateDraft(g.id, { subtitle: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <label className="text-sm">
                        Short description (homepage card)
                        <input value={g.short_description ?? ""} onChange={(e) => updateDraft(g.id, { short_description: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <label className="text-sm md:col-span-2">
                        SEO title
                        <input value={g.seo_title ?? ""} onChange={(e) => updateDraft(g.id, { seo_title: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <label className="text-sm md:col-span-2">
                        Meta description
                        <textarea value={g.meta_description ?? ""} onChange={(e) => updateDraft(g.id, { meta_description: e.target.value })} rows={2} className="mt-1 w-full border rounded px-2 py-1.5" />
                      </label>
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">Rich description (shown below gallery on category page)</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={aiAction[g.id] ?? "rewrite"}
                              onChange={(e) => setAiAction((prev) => ({ ...prev, [g.id]: e.target.value as "generate" | "rewrite" | "expand" | "shorten" | "seo" }))}
                              className="text-xs border rounded px-2 py-1"
                            >
                              <option value="generate">Generate new</option>
                              <option value="rewrite">Rewrite</option>
                              <option value="expand">Expand</option>
                              <option value="shorten">Shorten</option>
                              <option value="seo">Improve SEO</option>
                            </select>
                            <button
                              type="button"
                              className="text-xs border border-black rounded px-2 py-1 hover:bg-black hover:text-white"
                              onClick={async () => {
                                const current = g.description_html ?? "";
                                if (current.trim() && !confirm("Apply AI output to the editor? Your current draft will be replaced in the editor only.")) return;
                                const out = await runAi({
                                  data: {
                                    title: g.title,
                                    subtitle: g.subtitle ?? undefined,
                                    currentHtml: current || undefined,
                                    action: aiAction[g.id] ?? "rewrite",
                                    language: aiLang,
                                  },
                                });
                                updateDraft(g.id, { description_html: sanitizeHtml(out.html || "") });
                              }}
                            >
                              Generate with AI
                            </button>
                          </div>
                        </div>
                        <RichTextEditor
                          value={g.description_html ?? ""}
                          onChange={(html) => updateDraft(g.id, { description_html: sanitizeHtml(html) })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={g.visible} onChange={(e) => updateDraft(g.id, { visible: e.target.checked })} />
                        Visible
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={g.is_service} onChange={(e) => updateDraft(g.id, { is_service: e.target.checked })} />
                        Show in What We Do
                      </label>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => saveOne(g)} disabled={busyId === g.id} className="text-sm px-3 py-1.5 bg-black text-white rounded disabled:opacity-60">
                        {busyId === g.id ? "Saving..." : "Save gallery"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Delete gallery "${g.title}"?`)) return;
                          await removeGallery({ data: { galleryId: g.id } });
                          await refetch();
                          invalidate();
                        }}
                        className="text-sm px-3 py-1.5 border border-red-300 text-red-600 rounded"
                      >
                        Delete gallery
                      </button>
                      <Link to="/work/$slug" params={{ slug: g.slug }} className="text-sm px-3 py-1.5 border rounded hover:bg-neutral-50">
                        Open page
                      </Link>
                    </div>

                    <GalleryDropZone id={g.id}>
                      <div className="mt-4 border rounded p-3 bg-neutral-50">
                        <div className="text-xs text-neutral-600 mb-2">
                          Drag images and drop them on another gallery block to move them.
                        </div>
                        {g.gallery_images.length ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {g.gallery_images
                              .sort((a, b) => a.position - b.position)
                              .map((img) => (
                                <ImageDraggable
                                  key={img.id}
                                  image={img}
                                  isCover={g.cover_image_id === img.id}
                                  onSetCover={async () => {
                                    await setCover({ data: { galleryId: g.id, imageId: img.id } });
                                    await refetch();
                                    invalidate();
                                  }}
                                  onRemove={async () => {
                                    await removeImage({ data: { imageId: img.id } });
                                    await refetch();
                                    invalidate();
                                  }}
                                />
                              ))}
                          </div>
                        ) : (
                          <div className="text-sm text-neutral-500">No images in this gallery.</div>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const bytes = new Uint8Array(await file.arrayBuffer());
                              let bin = "";
                              const chunk = 0x8000;
                              for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
                              const dataBase64 = btoa(bin);
                              const res = await upload({ data: { filename: file.name, contentType: file.type, dataBase64, kind: "image" } });
                              await addImage({ data: { gallerySlug: g.slug, src: res.url, alt: "" } });
                              await refetch();
                              invalidate();
                              e.target.value = "";
                            }}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </GalleryDropZone>
                  </SortableGallery>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
