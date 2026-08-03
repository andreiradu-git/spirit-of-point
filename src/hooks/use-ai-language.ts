import { useEffect, useState } from "react";

export type AiLang = "en" | "ro";

const KEY = "point-studio-ai-language";
const EVT = "point-studio-ai-language-change";

function read(): AiLang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(KEY) === "ro" ? "ro" : "en";
}

/** Global language used by every AI text feature (copy, alt text, titles, SEO). */
export function useAiLanguage() {
  const [lang, setLangState] = useState<AiLang>("en");

  useEffect(() => {
    setLangState(read());
    const onChange = () => setLangState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setLang = (next: AiLang) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVT));
    setLangState(next);
  };

  return { lang, setLang };
}
