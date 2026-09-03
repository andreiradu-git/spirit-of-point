import { useState, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useList, useSaveList } from "@/hooks/use-site-lists";
import { useServerFn } from "@tanstack/react-start";
import { generateSiteText } from "@/lib/text-ai.functions";
import { useLang, textKey } from "@/i18n";

type Props = {
  id: string;
  fallback: string[];
  /** Optional custom renderer for read-only mode. Defaults to <editableTag>{text}</editableTag>. */
  renderItem?: (text: string, index: number) => ReactNode;
  /** Text used as button label & AI context, e.g. "paragraf", "punct", "întrebare" */
  itemLabel?: string;
  lang?: "en" | "ro";
  /** Wrap for whole list; default <div> */
  as?: "div" | "ul" | "ol" | "dl";
  className?: string;
  itemClassName?: string;
  /** Tag used to render each item in read-only mode. */
  editableTag?: "p" | "li" | "span" | "div";
  multiline?: boolean;
};

/**
 * Renders an array of strings that admins can inline-edit, reorder, add, delete,
 * and rewrite with AI. Storage lives in site_settings under `list.<id>`.
 */
export function EditableTextList({
  id,
  fallback,
  renderItem,
  itemLabel = "item",
  lang,
  as: Tag = "div",
  className,
  itemClassName,
  editableTag = "p",
  multiline = true,
}: Props) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;

  const listKey = textKey(id, useLang());
  const items = useList<string>(listKey, fallback);
  const saveList = useSaveList();
  const save = (_id: string, next: unknown) => saveList(listKey, next as never);
  const runAi = useServerFn(generateSiteText);
  const [busy, setBusy] = useState<number | "add" | null>(null);

  if (!editable) {
    const ItemTag = editableTag;
    return (
      <Tag className={className}>
        {items.map((t, i) =>
          renderItem ? renderItem(t, i) : (
            <ItemTag key={i} className={itemClassName}>{t}</ItemTag>
          ),
        )}
      </Tag>
    );
  }

  const update = async (next: string[]) => {
    await save(id, next);
  };

  const editItem = async (index: number) => {
    const current = items[index] ?? "";
    const nextText = multiline
      ? window.prompt(`Editează ${itemLabel}:`, current)
      : window.prompt(`Editează ${itemLabel}:`, current);
    if (nextText === null) return;
    const next = [...items];
    next[index] = nextText;
    await update(next);
  };

  const aiRewrite = async (index: number) => {
    const promptLabel = lang === "ro"
      ? `Cum să rescrie AI acest ${itemLabel}? (gol = îmbunătățire generală)`
      : `How should AI rewrite this ${itemLabel}?`;
    const instruction = window.prompt(promptLabel, "");
    if (instruction === null) return;
    setBusy(index);
    try {
      const out = await runAi({
        data: {
          fieldId: `${id}.${index}`,
          instruction: instruction || undefined,
          current: items[index] ?? "",
          maxChars: 1200,
          language: lang,
        },
      });
      if (out.text) {
        const next = [...items];
        next[index] = out.text;
        await update(next);
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const addItem = async () => {
    setBusy("add");
    try {
      const nextText = window.prompt(`Adaugă ${itemLabel}:`, "");
      if (nextText === null) return;
      await update([...items, nextText || `Nou ${itemLabel}`]);
    } finally {
      setBusy(null);
    }
  };

  const aiAddItem = async () => {
    const promptLabel = lang === "ro"
      ? `Ce ${itemLabel} vrei ca AI să adauge? (descrie subiectul)`
      : `What ${itemLabel} should AI add? (describe the topic)`;
    const instruction = window.prompt(promptLabel, "");
    if (instruction === null) return;
    setBusy("add");
    try {
      const context = items.slice(0, 3).join("\n---\n");
      const out = await runAi({
        data: {
          fieldId: `${id}.new`,
          instruction: instruction || `Scrie un nou ${itemLabel} în același stil.`,
          context,
          maxChars: 1200,
          language: lang,
        },
      });
      if (out.text) await update([...items, out.text]);
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const removeItem = async (index: number) => {
    if (!window.confirm(`Șterge acest ${itemLabel}?`)) return;
    const next = items.filter((_, i) => i !== index);
    await update(next);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await update(next);
  };

  const Item = editableTag;

  return (
    <Tag className={className}>
      {items.map((text, i) => (
        <div
          key={i}
          className={
            "group relative rounded-sm outline outline-1 outline-dashed outline-blue-400/40 hover:outline-blue-500 p-2 my-2 " +
            (itemClassName ?? "")
          }
        >
          <Item className="whitespace-pre-wrap">{text}</Item>
          <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button type="button" onClick={() => move(i, -1)} title="Sus" className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">↑</button>
            <button type="button" onClick={() => move(i, 1)} title="Jos" className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">↓</button>
            <button type="button" onClick={() => editItem(i)} title="Editează" className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">✏️</button>
            <button
              type="button"
              onClick={() => aiRewrite(i)}
              disabled={busy === i}
              title="Rescrie cu AI"
              className="text-[10px] bg-black text-white rounded px-1.5 py-0.5"
            >
              {busy === i ? "…" : "✨AI"}
            </button>
            <button type="button" onClick={() => removeItem(i)} title="Șterge" className="text-[10px] bg-red-600 text-white rounded px-1.5 py-0.5">✕</button>
          </div>
        </div>
      ))}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={addItem}
          disabled={busy === "add"}
          className="text-xs bg-white border border-dashed border-blue-400 text-blue-600 rounded px-2 py-1 hover:bg-blue-50"
        >
          + Adaugă {itemLabel}
        </button>
        <button
          type="button"
          onClick={aiAddItem}
          disabled={busy === "add"}
          className="text-xs bg-black text-white rounded px-2 py-1"
        >
          {busy === "add" ? "…" : `✨ Adaugă cu AI`}
        </button>
      </div>
    </Tag>
  );
}
