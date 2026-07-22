import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";

const BASE_NAV = [
  { to: "/", label: "Home" },
  { to: "/food", label: "Food" },
  { to: "/patterns", label: "Patterns" },
  { to: "/people", label: "People" },
  { to: "/editorial", label: "Editorial" },
  { to: "/contact", label: "Contact" },
] as const;

type NavItem = { to: string; label: string };

export function SiteLayout({
  children,
  transparentHeader = false,
  headerTone = "dark",
}: {
  children: ReactNode;
  transparentHeader?: boolean;
  headerTone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { settings, update, ready } = useSiteSettings();

  const nav: NavItem[] = [...BASE_NAV];
  if (settings.showVideo) {
    // insert Video before Contact
    nav.splice(nav.length - 1, 0, { to: "/video", label: "Video" });
  }

  const light = headerTone === "light";
  const textActive = light ? "text-white" : "text-foreground";
  const textIdle = light ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className={`${
          transparentHeader
            ? "absolute top-0 left-0 right-0 z-40 bg-transparent"
            : "sticky top-0 z-40 backdrop-blur bg-background/80"
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 h-24 flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Point Studio">
            <img
              src="https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/3236b78e-0c1c-48e9-83fd-bbfa1f67650f/LOGO_PSP.png?format=400w"
              alt="Point Studio"
              className={`h-14 md:h-20 w-auto object-contain ${light ? "" : "invert brightness-0"}`}
            />
          </Link>
          <nav className="hidden md:flex gap-8 text-xs uppercase tracking-[0.2em]">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`transition-colors ${path === n.to ? textActive : textIdle}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => setOpen(!open)}
            className={`md:hidden text-xs uppercase tracking-widest ${light ? "text-white" : ""}`}
            aria-label="Menu"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav
            className={`md:hidden px-6 py-4 flex flex-col gap-3 text-sm uppercase tracking-[0.2em] ${
              light ? "bg-black/70 text-white" : "border-t border-border bg-background"
            }`}
          >
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border mt-24">
        <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6 text-sm text-muted-foreground">
          <div>
            <div className="font-serif text-xl text-foreground">Point Studio</div>
            <p className="mt-2 max-w-sm italic">
              First and foremost, we love what we do.
            </p>
          </div>
          <div className="space-y-1">
            <div>andrei@pointstudio.ro</div>
            <div>+40 744 341 286</div>
            <div>Piața Presei Libere 1, Bucharest</div>
          </div>
          <div>© {new Date().getFullYear()} Point Studio</div>
        </div>
      </footer>

      {ready && (
        <SettingsPanel
          showVideo={settings.showVideo}
          onToggleVideo={() => update({ showVideo: !settings.showVideo })}
        />
      )}
    </div>
  );
}

function SettingsPanel({
  showVideo,
  onToggleVideo,
}: {
  showVideo: boolean;
  onToggleVideo: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-64 rounded-lg border border-border bg-background shadow-xl p-4 space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Site controls
          </div>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Show Video in menu</span>
            <input
              type="checkbox"
              checked={showVideo}
              onChange={onToggleVideo}
              className="h-4 w-4 accent-foreground"
            />
          </label>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Toggle sections shown in the public site. Saved locally in this browser.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center text-lg"
        aria-label="Site settings"
        title="Site settings"
      >
        ⚙
      </button>
    </div>
  );
}

export function cdn(url: string, w = 1500) {
  return `${url}?format=${w}w`;
}
