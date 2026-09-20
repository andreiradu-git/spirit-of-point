import { useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useList, useSaveList } from "@/hooks/use-site-lists";
import { useServerFn } from "@tanstack/react-start";
import { generateSiteText } from "@/lib/text-ai.functions";
import { textKey } from "@/i18n";
import { useContentLang } from "@/hooks/use-content-lang";

export type FaqItem = { q: string; a: string };

type Props = {
  id: string;
  fallback: FaqItem[];
  lang?: "en" | "ro";
};

export function EditableFaqList({ id, fallback, lang = "ro" }: Props) {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const editable = isAdmin && editMode;

  const listKey = textKey(id, useContentLang());
  const items = useList<FaqItem>(listKey, fallback);
  const saveList = useSaveList();
  const save = (_id: string, next: unknown) => saveList(listKey, next as never);
  const runAi = useServerFn(generateSiteText);
  const [busy, setBusy] = useState<string | null>(null);

  const update = (next: FaqItem[]) => save(id, next);

  if (!editable) {
    return (
      <dl className="space-y-4">
        {items.map((f, i) => (
          <div key={i}>
            <dt className="font-semibold text-foreground">Q: {f.q}</dt>
            <dd className="mt-1 text-foreground/80">A: {f.a}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const editField = async (index: number, field: "q" | "a") => {
    const current = items[index]?.[field] ?? "";
    const next = window.prompt(field === "q" ? "Întrebare:" : "Răspuns:", current);
    if (next === null) return;
    const list = [...items];
    list[index] = { ...list[index], [field]: next };
    await update(list);
  };

  const aiField = async (index: number, field: "q" | "a") => {
    const label = field === "q" ? "întrebarea" : "răspunsul";
    const instruction = window.prompt(
      `Cum să rescrie AI ${label}? (gol = îmbunătățire)`,
      "",
    );
    if (instruction === null) return;
    const key = `${index}-${field}`;
    setBusy(key);
    try {
      const context =
        field === "a"
          ? `Întrebarea la care răspunzi: ${items[index]?.q ?? ""}`
          : `Răspunsul asociat: ${items[index]?.a ?? ""}`;
      const out = await runAi({
        data: {
          fieldId: `${id}.${index}.${field}`,
          instruction: instruction || undefined,
          current: items[index]?.[field] ?? "",
          context,
          maxChars: 800,
          language: lang,
        },
      });
      if (out.text) {
        const list = [...items];
        list[index] = { ...list[index], [field]: out.text };
        await update(list);
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (index: number) => {
    if (!window.confirm("Șterge această întrebare?")) return;
    await update(items.filter((_, i) => i !== index));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...items];
    const t = index + dir;
    if (t < 0 || t >= next.length) return;
    [next[index], next[t]] = [next[t], next[index]];
    await update(next);
  };

  const addManual = async () => {
    const q = window.prompt("Întrebare nouă:", "");
    if (q === null) return;
    const a = window.prompt("Răspuns:", "");
    if (a === null) return;
    await update([...items, { q, a }]);
  };

  const addAi = async () => {
    const topic = window.prompt(
      "Despre ce să fie noua întrebare FAQ? (ex: preț, durata ședinței, livrare)",
      "",
    );
    if (topic === null) return;
    setBusy("add");
    try {
      const context = items
        .slice(0, 3)
        .map((f) => `Q: ${f.q}\nA: ${f.a}`)
        .join("\n---\n");
      const outQ = await runAi({
        data: {
          fieldId: `${id}.new.q`,
          instruction: `Scrie o nouă întrebare de FAQ despre: ${topic || "un subiect relevant pentru pagina"}. Doar întrebarea, fără răspuns.`,
          context,
          maxChars: 200,
          language: lang,
        },
      });
      const outA = await runAi({
        data: {
          fieldId: `${id}.new.a`,
          instruction: `Scrie răspunsul pentru această întrebare: "${outQ.text}". Ton profesional, natural, 2-4 propoziții.`,
          context,
          maxChars: 800,
          language: lang,
        },
      });
      if (outQ.text && outA.text) {
        await update([...items, { q: outQ.text, a: outA.text }]);
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <dl className="space-y-4">
        {items.map((f, i) => (
          <div key={i} className="group relative outline outline-1 outline-dashed outline-blue-400/40 hover:outline-blue-500">
            <dt className="font-semibold text-foreground">
              Q: <span className="whitespace-pre-wrap">{f.q}</span>
            </dt>
            <dd className="mt-1 text-foreground/80 whitespace-pre-wrap">
              A: {f.a}
            </dd>
            <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button type="button" onClick={() => editField(i, "q")} title="Editează întrebarea" className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">Q✏️</button>
              <button type="button" onClick={() => aiField(i, "q")} disabled={busy === `${i}-q`} title="Rescrie întrebarea cu AI" className="text-[10px] bg-black text-white rounded px-1.5 py-0.5">{busy === `${i}-q` ? "…" : "Q✨"}</button>
              <button type="button" onClick={() => editField(i, "a")} title="Editează răspunsul" className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">A✏️</button>
              <button type="button" onClick={() => aiField(i, "a")} disabled={busy === `${i}-a`} title="Rescrie răspunsul cu AI" className="text-[10px] bg-black text-white rounded px-1.5 py-0.5">{busy === `${i}-a` ? "…" : "A✨"}</button>
              <button type="button" onClick={() => move(i, -1)} className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="text-[10px] bg-white border border-border rounded px-1.5 py-0.5">↓</button>
              <button type="button" onClick={() => remove(i)} className="text-[10px] bg-red-600 text-white rounded px-1.5 py-0.5">✕</button>
            </div>
          </div>
        ))}
      </dl>
      <div className="absolute flex gap-2 translate-y-3 m-0">
        <button type="button" onClick={addManual} className="text-xs bg-white border border-dashed border-blue-400 text-blue-600 rounded px-2 py-1 hover:bg-blue-50">+ Adaugă întrebare</button>
        <button type="button" onClick={addAi} disabled={busy === "add"} className="text-xs bg-black text-white rounded px-2 py-1">{busy === "add" ? "…" : "✨ Adaugă cu AI"}</button>
      </div>
    </div>
  );
}
