import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText, useSaveText } from "@/hooks/use-site-texts";

type Props = {
  id: string;
  children: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
};

/**
 * Renders text that admins can edit inline when Edit Mode is on.
 * `id` is a stable identifier (e.g. "hero.title"). `children` is the fallback text.
 */
export function Editable({
  id,
  children,
  as: Tag = "span",
  className,
  multiline = false,
  placeholder,
}: Props): ReactNode {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const value = useText(id, children);
  const save = useSaveText();
  const ref = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const editable = isAdmin && editMode;

  // Keep DOM text in sync when value from DB changes (only when not focused)
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

  if (!editable) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref as never}
      className={
        (className ? className + " " : "") +
        "outline outline-1 outline-dashed outline-blue-400/60 focus:outline-blue-500 focus:outline-2 rounded-sm px-0.5 -mx-0.5 " +
        (saving ? "opacity-60" : "")
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
  );
}
