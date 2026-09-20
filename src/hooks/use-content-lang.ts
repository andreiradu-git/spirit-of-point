import { useCallback, useEffect, useState } from "react";
import { useLang, type Lang } from "@/i18n";

const KEY = "point-studio-edit-language";
const EVT = "point-studio-edit-language-change";

function read(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "ro" || v === "en" ? v : null;
}

/**
 * The language reflected by the Admin editing selector. The AdminBar keeps
 * this value synchronized with the current public route.
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

  const setEditLang = useCallback((next: Lang) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVT));
    setState(next);
  }, []);

  return { editLang, setEditLang };
}

/**
 * Language whose stored content should be loaded, shown and saved.
 *
 * The route is the single source of truth. This guarantees that the visible
 * website language and every editable text/list key can never disagree.
 */
export function useContentLang(): Lang {
  return useLang();
}
