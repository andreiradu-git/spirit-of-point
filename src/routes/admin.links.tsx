import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { useAdmin } from "@/hooks/use-admin";
import { useSiteList } from "@/hooks/use-site-list";
import { useServerFn } from "@tanstack/react-start";
import { generateLinkMeta } from "@/lib/links.functions";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SiteLink = {
  id: string;
  url: string;
  title: string;
  description: string;
  category: string;
  visible: boolean;
};

const CATEGORIES = ["social", "portfolio", "press", "shop", "resource", "other"];

export const Route = createFileRoute("/admin/links")({
  component: LinksAdmin,
  head: () => ({ meta: [{ title: "Links Manager — Admin" }] }),
});

function LinksAdmin() {
  const { user, isAdmin, loading } = useAdmin();
  const { items, save } = useSiteList<SiteLink>("links", []);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const ai = useServerFn(generateLinkMeta);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => {
    return items.filter((l) => {
      if (filter !== "all" && l.category !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          l.url.toLowerCase().includes(s) ||
          l.title.toLowerCase().includes(s) ||
          l.description.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!user || !isAdmin)
    return (
      <div className="p-8">
        <Link to="/auth" className="underline">
          Sign in
        </Link>{" "}
        as admin to manage links.
      </div>
    );

  const add = async () => {
    const next: SiteLink = {
      id: crypto.randomUUID(),
      url: "",
      title: "New link",
      description: "",
      category: "other",
      visible: true,
    };
    await save([next, ...items]);
  };

  const update = async (id: string, patch: Partial<SiteLink>) => {
    await save(items.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    await save(items.filter((l) => l.id !== id));
  };

  const runAi = async (link: SiteLink) => {
    if (!link.url) return alert("Add a URL first");
    setBusyId(link.id);
    try {
      const out = await ai({ data: { url: link.url } });
      await update(link.id, {
        title: out.title || link.title,
        description: out.description || link.description,
        category: out.category || link.category,
      });
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((l) => l.id === active.id);
    const to = items.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    await save(arrayMove(items, from, to));
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-24">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-serif">Links Manager</h1>
            <p className="text-sm text-muted-foreground">
              Reusable link library — used across the site (footer, socials, press…).
            </p>
          </div>
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded hover:bg-neutral-800 text-sm"
          >
            <Plus className="w-4 h-4" /> Add link
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URL, title, description…"
            className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All categories ({items.length})</option>
            {CATEGORIES.map((c) => {
              const n = items.filter((l) => l.category === c).length;
              return (
                <option key={c} value={c}>
                  {c} ({n})
                </option>
              );
            })}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="border-2 border-dashed rounded p-12 text-center text-muted-foreground">
            No links yet. Click "Add link" to create your first one.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={filtered.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {filtered.map((l) => (
                  <LinkRow
                    key={l.id}
                    link={l}
                    aiBusy={busyId === l.id}
                    onChange={(p) => update(l.id, p)}
                    onRemove={() => remove(l.id)}
                    onAi={() => runAi(l)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </SiteLayout>
  );
}

function LinkRow({
  link,
  aiBusy,
  onChange,
  onRemove,
  onAi,
}: {
  link: SiteLink;
  aiBusy: boolean;
  onChange: (p: Partial<SiteLink>) => void;
  onRemove: () => void;
  onAi: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start bg-white border rounded p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 text-neutral-400 hover:text-neutral-700 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex gap-2 items-center">
          <input
            defaultValue={link.title}
            onBlur={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            className="flex-1 min-w-0 border rounded px-2 py-1 text-sm font-medium"
          />
          <select
            value={link.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className="border rounded px-2 py-1 text-xs"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <input
            defaultValue={link.url}
            onBlur={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
            className="flex-1 min-w-0 border rounded px-2 py-1 text-xs font-mono"
          />
          {link.url && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 border rounded hover:bg-neutral-100"
              title="Open"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <textarea
          defaultValue={link.description}
          onBlur={(e) => onChange({ description: e.target.value })}
          placeholder="Short description"
          rows={2}
          className="border rounded px-2 py-1 text-xs resize-y"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onAi}
          disabled={aiBusy || !link.url}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black text-white text-xs hover:bg-neutral-800 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI
        </button>
        <button
          type="button"
          onClick={() => onChange({ visible: !link.visible })}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs ${
            link.visible ? "bg-white" : "bg-neutral-200 text-neutral-500"
          }`}
          title={link.visible ? "Visible" : "Hidden"}
        >
          {link.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {link.visible ? "Shown" : "Hidden"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
