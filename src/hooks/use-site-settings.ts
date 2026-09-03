import { useEffect, useState } from "react";

export type SiteSettings = {
  showVideo: boolean;
  showWanders: boolean;
  showTestimonials: boolean;
  showFotografieCulinara: boolean;
};

const DEFAULTS: SiteSettings = {
  showVideo: true,
  showWanders: true,
  showTestimonials: true,
  showFotografieCulinara: true,
};
const KEY = "point-studio-settings";
const EVT = "point-studio-settings-change";

function read(): SiteSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<SiteSettings> & { showPatterns?: boolean };
    return {
      ...DEFAULTS,
      ...saved,
      showWanders: typeof saved.showWanders === "boolean" ? saved.showWanders : saved.showPatterns ?? DEFAULTS.showWanders,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(read());
    setReady(true);
    const onChange = () => setSettings(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<SiteSettings>) => {
    const next = { ...read(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
    setSettings(next);
  };

  return { settings, update, ready };
}
