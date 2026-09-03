import { useRouterState } from "@tanstack/react-router";
import { RO_CONTENT } from "./ro-content";
import { UI_RO } from "./ui";

export type Lang = "en" | "ro";

export const SITE_URL = "https://www.pointstudio.ro";

/** Language implied by a pathname. English is the default and keeps bare URLs. */
export function langFromPath(pathname: string): Lang {
  return pathname === "/ro" || pathname.startsWith("/ro/") ? "ro" : "en";
}

/** Path without the /ro prefix (always starts with "/"). */
export function basePath(pathname: string): string {
  if (pathname === "/ro") return "/";
  if (pathname.startsWith("/ro/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

/** Pages whose EN/RO URLs differ (not just a /ro prefix). */
const PATH_PAIRS: Record<string, string> = {
  "/food-photography-bucharest": "/fotografie-culinara-bucuresti",
  "/fotografie-culinara-bucuresti": "/food-photography-bucharest",
};

/** Same page, in the requested language. */
export function localizePath(path: string, lang: Lang): string {
  const pair = PATH_PAIRS[basePath(path)];
  if (pair) return pair;
  const base = basePath(path);
  if (lang === "en") return base;
  return base === "/" ? "/ro" : `/ro${base}`;
}

export function useLang(): Lang {
  return useRouterState({ select: (s) => langFromPath(s.location.pathname) });
}

export function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** Translate a hardcoded English UI string. Falls back to English. */
export function tr(lang: Lang, en: string): string {
  if (lang === "en") return en;
  return UI_RO[en] ?? en;
}

export function useTr() {
  const lang = useLang();
  return (en: string) => tr(lang, en);
}

/** CMS storage key for an editable text id in a given language. */
export function textKey(id: string, lang: Lang): string {
  return lang === "ro" ? `${id}#ro` : id;
}

/** Romanian default for an editable id, falling back to the English source copy. */
export function contentDefault(id: string, lang: Lang, en: string): string {
  if (lang === "en") return en;
  return RO_CONTENT[id] ?? en;
}

/** Absolute canonical + reciprocal hreflang tags for an EN/RO page pair. */
export function altLinks(basePathname: string, lang: Lang) {
  const en = `${SITE_URL}${basePathname === "/" ? "/" : basePathname}`;
  const ro = `${SITE_URL}${basePathname === "/" ? "/ro" : `/ro${basePathname}`}`;
  const self = lang === "ro" ? ro : en;
  return {
    meta: [{ property: "og:url", content: self }],
    links: [
      { rel: "canonical", href: self },
      { rel: "alternate", hrefLang: "en", href: en },
      { rel: "alternate", hrefLang: "ro", href: ro },
      { rel: "alternate", hrefLang: "x-default", href: en },
    ],
  };
}
