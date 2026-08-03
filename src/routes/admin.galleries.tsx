import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/hooks/use-admin";
import { useAiLanguage } from "@/hooks/use-ai-language";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Loader2,
  Trash2,
  Pencil,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  Navigation,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  listAllGalleries,
  createGallery,
  updateGalleryMeta,
  deleteGallery,
  reorderGalleries,
} from "@/lib/media.functions";
import { generateGalleryPageCopy } from "@/lib/text-ai.functions";

export const Route = createFileRoute("/admin/galleries")({
  head: () => ({
    meta: [
      { title: "Galleries — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminGalleriesPage,
});

type GalleryRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  subtitle: string | null;
  description: string | null;
  seo_title: string | null;
  meta_description: string | null;
  sort_order: number;
  visible: boolean;
  show_in_nav: boolean;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AdminGalleriesPage() {
  const { user, isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllGalleries);
  const createFn = useServerFn(createGallery);
  const reorderFn = useServerFn(reorderGalleries);

  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/auth" });
  }, [loading, user, isAdmin, navigate]);

  const reload = async () => {
    setFetching(true);
    try {
      const data = await listFn();
      setGalleries(data as GalleryRow[]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = galleries.findIndex((g) => g.id === active.id);
    const newIndex = galleries.findIndex((g) => g.id === over.id);
    const next = arrayMove(galleries, oldIndex, newIndex);
    setGalleries(next);
    try {
      await reorderFn({ data: { ids: next.map((g) => g.id) } });
      qc.invalidateQueries({ queryKey: ["galleries"] });
    } catch (e) {
      alert("Reorder failed: " + (e instanceof Error ? e.message : String(e)));
      reload();
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    setCreating(true);
    try {
      await createFn({ data: { title: newTitle.trim(), slug: newSlug.trim() } });
      setNewTitle("");
      setNewSlug("");
      setShowCreate(false);
      await reload();
      qc.invalidateQueries({ queryKey: ["galleries"] });
    } catch (e) {
      alert("Create failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCreating(false);
    }
  };

  const onUpdated = (id: string, patch: Partial<GalleryRow>) => {
    setGalleries((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    qc.invalidateQueries({ queryKey: ["galleries"] });
    qc.invalidateQueries({ queryKey: ["gallery"] });
  };

  const onDeleted = (id: string) => {
    setGalleries((prev) => prev.filter((g) => g.id !== id));
    qc.invalidateQueries({ queryKey: ["galleries"] });
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-neutral-50 pt-14 pb-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif">Galleries</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Create, rename, reorder and configure every gallery. Changes appear instantly on the site.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-black text-white text-sm hover:bg-neutral-800"
          >
            <Plus className="w-4 h-4" />
            New gallery
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 bg-white border rounded-lg p-4 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-[11px] uppercase tracking-wider text-neutral-500">Title</label>
              <input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!newSlug) {
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                  }
                }}
                placeholder="e.g. Wedding"
                className="border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-[11px] uppercase tracking-wider text-neutral-500">URL slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                placeholder="e.g. wedding"
                className="border rounded px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newTitle.trim() || !newSlug.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-black text-white text-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded border text-sm hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        )}

        {fetching ? (
          <div className="text-sm text-neutral-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading galleries…
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={galleries.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {galleries.map((g) => (
                  <GalleryCard
                    key={g.id}
                    gallery={g}
                    onUpdated={onUpdated}
                    onDeleted={onDeleted}
                  />
                ))}
                {galleries.length === 0 && (
                  <p className="text-sm text-neutral-500 text-center py-12">No galleries yet. Create one above.</p>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery card
// ---------------------------------------------------------------------------

function GalleryCard({
  gallery,
  onUpdated,
  onDeleted,
}: {
  gallery: GalleryRow;
  onUpdated: (id: string, patch: Partial<GalleryRow>) => void;
  onDeleted: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: gallery.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const updateFn = useServerFn(updateGalleryMeta);
  const deleteFn = useServerFn(deleteGallery);
  const genFn = useServerFn(generateGalleryPageCopy);
  const { lang: aiLang } = useAiLanguage();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [title, setTitle] = useState(gallery.title);
  const [slug, setSlug] = useState(gallery.slug);
  const [tagline, setTagline] = useState(gallery.tagline ?? "");
  const [subtitle, setSubtitle] = useState(gallery.subtitle ?? "");
  const [description, setDescription] = useState(gallery.description ?? "");
  const [seoTitle, setSeoTitle] = useState(gallery.seo_title ?? "");
  const [metaDesc, setMetaDesc] = useState(gallery.meta_description ?? "");
  const [visible, setVisible] = useState(gallery.visible);
  const [showInNav, setShowInNav] = useState(gallery.show_in_nav);

  const dirty =
    title !== gallery.title ||
    slug !== gallery.slug ||
    tagline !== (gallery.tagline ?? "") ||
    subtitle !== (gallery.subtitle ?? "") ||
    description !== (gallery.description ?? "") ||
    seoTitle !== (gallery.seo_title ?? "") ||
    metaDesc !== (gallery.meta_description ?? "") ||
    visible !== gallery.visible ||
    showInNav !== gallery.show_in_nav;

  const doSave = async () => {
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: gallery.id,
          title: title.trim(),
          slug: slug.trim(),
          tagline: tagline.trim() || null,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          seo_title: seoTitle.trim() || null,
          meta_description: metaDesc.trim() || null,
          visible,
          show_in_nav: showInNav,
        },
      });
      onUpdated(gallery.id, {
        title: title.trim(),
        slug: slug.trim(),
        tagline: tagline.trim() || null,
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        seo_title: seoTitle.trim() || null,
        meta_description: metaDesc.trim() || null,
        visible,
        show_in_nav: showInNav,
      });
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const doToggleVisible = async () => {
    const next = !visible;
    setVisible(next);
    try {
      await updateFn({ data: { id: gallery.id, visible: next } });
      onUpdated(gallery.id, { visible: next });
    } catch (e) {
      setVisible(!next);
      alert("Update failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const doToggleNav = async () => {
    const next = !showInNav;
    setShowInNav(next);
    try {
      await updateFn({ data: { id: gallery.id, show_in_nav: next } });
      onUpdated(gallery.id, { show_in_nav: next });
    } catch (e) {
      setShowInNav(!next);
      alert("Update failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const doDelete = async () => {
    if (
      !window.confirm(
        `Delete gallery "${gallery.title}"?\n\nThis will remove all images from the gallery (but not from the asset library). This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteFn({ data: { id: gallery.id } });
      onDeleted(gallery.id);
    } catch (e) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
      setDeleting(false);
    }
  };

  const doAi = async (instruction?: string) => {
    setAiBusy(true);
    try {
      const out = await genFn({
        data: {
          galleryTitle: title,
          gallerySlug: slug,
          existingDescription: description || undefined,
          instruction,
          language: aiLang,
        },
      });
      if (!description || window.confirm("Replace existing description with AI-generated content?")) {
        if (out.subtitle) setSubtitle(out.subtitle);
        if (out.description) setDescription(out.description);
        if (out.seo_title) setSeoTitle(out.seo_title);
        if (out.meta_description) setMetaDesc(out.meta_description);
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg overflow-hidden ${isDragging ? "opacity-50 shadow-xl" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-700 p-1 shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{gallery.title}</span>
            <span className="text-[11px] text-neutral-400 font-mono">/{gallery.slug}</span>
            {!visible && (
              <span className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 rounded">hidden</span>
            )}
            {showInNav && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">in nav</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <a
            href={`/work/${gallery.slug}`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-neutral-100"
            title="Open page"
          >
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
          </a>
          <button
            type="button"
            onClick={doToggleNav}
            className={`p-1.5 rounded hover:bg-neutral-100 ${showInNav ? "text-blue-600" : "text-neutral-400"}`}
            title={showInNav ? "Remove from navigation" : "Add to navigation"}
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={doToggleVisible}
            className={`p-1.5 rounded hover:bg-neutral-100 ${visible ? "text-green-600" : "text-neutral-400"}`}
            title={visible ? "Visible — click to hide" : "Hidden — click to show"}
          >
            {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
            title={expanded ? "Collapse" : "Edit"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={doDelete}
            disabled={deleting}
            className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-40"
            title="Delete gallery"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t px-4 py-4 grid gap-3 text-sm bg-neutral-50">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border rounded px-2 py-1.5 bg-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">URL slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                className="border rounded px-2 py-1.5 bg-white font-mono text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Tagline (short, used in nav)</span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Food, Product & Tabletop Photography"
              className="border rounded px-2 py-1.5 bg-white"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">Subtitle (displayed on page)</span>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Short evocative line…"
              className="border rounded px-2 py-1.5 bg-white font-serif italic"
            />
          </label>

          {/* AI Description row */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Description (shown below gallery)</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => doAi()}
                  disabled={aiBusy}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black text-white text-[11px] hover:bg-neutral-800 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Generate with AI ({aiLang.toUpperCase()})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const instr = window.prompt("AI instruction (optional):", "Improve SEO while keeping the writing natural.");
                    if (instr !== null) doAi(instr);
                  }}
                  disabled={aiBusy}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] hover:bg-white disabled:opacity-50"
                >
                  Custom prompt…
                </button>
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this category — style, subjects, mood, why clients choose it…"
              rows={5}
              className="border rounded px-2 py-1.5 bg-white resize-y leading-relaxed"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">SEO Title (max 60 chars)</span>
              <input
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value.slice(0, 80))}
                placeholder="Leave blank to use gallery title"
                className="border rounded px-2 py-1.5 bg-white"
              />
              <span className="text-[10px] text-neutral-400">{seoTitle.length}/60</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">Meta description (140-160 chars)</span>
              <textarea
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value.slice(0, 200))}
                placeholder="Used in Google search results"
                rows={2}
                className="border rounded px-2 py-1.5 bg-white resize-none"
              />
              <span className="text-[10px] text-neutral-400">{metaDesc.length}/160</span>
            </label>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-black" />
              Visible on site
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} className="accent-black" />
              Show in navigation
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={doSave}
              disabled={saving || !dirty}
              className="px-4 py-1.5 rounded bg-black text-white text-sm hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(gallery.title);
                setSlug(gallery.slug);
                setTagline(gallery.tagline ?? "");
                setSubtitle(gallery.subtitle ?? "");
                setDescription(gallery.description ?? "");
                setSeoTitle(gallery.seo_title ?? "");
                setMetaDesc(gallery.meta_description ?? "");
                setVisible(gallery.visible);
                setShowInNav(gallery.show_in_nav);
              }}
              disabled={!dirty}
              className="px-4 py-1.5 rounded border text-sm hover:bg-neutral-100 disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
