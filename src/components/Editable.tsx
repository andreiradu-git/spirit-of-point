import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText, useSaveText } from "@/hooks/use-site-texts";
import { useServerFn } from "@tanstack/react-start";
import { generateSiteText } from "@/lib/text-ai.functions";
import { useAiLanguage } from "@/hooks/use-ai-language";

type Props = {
  id: string;
  children: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  lang?: "en" | "ro";
};

/**
 * Renders text that admins can edit inline when Edit Mode is on.
 * When editable, a small "✨ AI" button appears to rewrite the copy with ChatGPT-style AI.
 */
export function Editable({
  id,
  children,
  as: Tag = "span",
  className,
  multiline = false,
  placeholder,
  lang,
}: Props): ReactNode {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const value = useText(id, children);
  const save = useSaveText();
  const runAi = useServerFn(generateSiteText);
  const { lang: globalLang } = useAiLanguage();
  const aiLang = lang ?? globalLang;
  const ref = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const editable = isAdmin && editMode;

  useEffect(() => {
    if (!editable) return;
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) {
      el.innerText = value;
    }
  }, [value, editable]);

  const commit = async () => {
    const el = ref.current;
    if (!el) return;
    const next = el.innerText.replace(/\u00a0/g, " ").trim();
    if (next === value) return;
    setSaving(true);
    try {
      await save(id, next);
    } catch (e) {
      console.error("Failed to save text", id, e);
      el.innerText = value;
    } finally {
      setSaving(false);
    }
  };

  const aiRewrite = async () => {
    const promptLabel = aiLang === "ro"
      ? "Cum vrei ca AI-ul să rescrie textul? (Lasă gol pentru îmbunătățire generală în română.)"
      : "How should the AI rewrite this? (Leave blank for a general improvement.)";
    const instruction = window.prompt(promptLabel, "");
    if (instruction === null) return;
    setAiBusy(true);
    try {
      const out = await runAi({
        data: {
          fieldId: id,
          instruction: instruction || undefined,
          current: value,
          maxChars: multiline ? 1200 : 240,
          language: aiLang,
        },
      });
      if (out.text) {
        await save(id, out.text);
        const el = ref.current;
        if (el) el.innerText = out.text;
      }
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  if (!editable) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <span className="relative inline-block group">
      <Tag
        ref={ref as never}
        className={
          (className ? className + " " : "") +
          "outline outline-1 outline-dashed outline-blue-400/60 focus:outline-blue-500 focus:outline-2 rounded-sm px-0.5 -mx-0.5 " +
          (saving || aiBusy ? "opacity-60" : "")
        }
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        data-placeholder={placeholder ?? id}
      >
        {value}
      </Tag>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={aiRewrite}
        disabled={aiBusy}
        title="Rewrite with AI"
        className="absolute -top-3 -right-3 text-[10px] bg-black text-white rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-100"
      >
        {aiBusy ? "…" : "✨AI"}
      </button>
    </span>
  );
}
