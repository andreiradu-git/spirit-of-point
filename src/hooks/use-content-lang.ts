import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useLang, type Lang } from "@/i18n";

const KEY = "point-studio-edit-language";
const EVT = "point-studio-edit-language-change";

function read(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "ro" || v === "en" ? v : null;
}

/**
 * The language an admin has explicitly chosen to edit, independent of the
 * public URL, the browser language or any locale detection. `null` means the
 * admin has not chosen yet, in which case the current page's language is used.
 */
export function useEditLangState() {
  const [editLang, setState] = useState<Lang | null>(null);

  useEffect(() => {
    setState(read());
    const handler = () => setState(read());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setEditLang = (next: Lang) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVT));
    setState(next);
  };

  return { editLang, setEditLang };
}

/**
 * Language whose stored content should be loaded, shown and saved.
 *
 * For visitors (and for admins with Edit mode off) this is always the language
 * of the current public URL, so public rendering, SEO and routing are
 * unchanged. Only an admin in Edit mode can override it with the RO/EN
 * selector in the admin bar; the override never touches the other language's
 * stored values, because every text/list is keyed per language.
 */
export function useContentLang(): Lang {
  const routeLang = useLang();
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const { editLang } = useEditLangState();
  if (isAdmin && editMode && editLang) return editLang;
  return routeLang;
}
