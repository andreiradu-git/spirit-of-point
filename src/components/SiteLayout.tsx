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
          <div className="flex flex-col gap-3 md:items-end">
            <SocialIcons />
            <div>© {new Date().getFullYear()} Point Studio</div>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/40744341286"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-[#25D366] text-white px-4 h-11 shadow-lg hover:brightness-105 text-sm font-medium"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.02 0C5.4 0 .04 5.36.04 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.94 11.94 0 0 0 5.82 1.48h.01c6.62 0 11.98-5.36 11.98-11.98 0-3.2-1.25-6.21-3.49-8.4ZM12.03 21.3h-.01a9.3 9.3 0 0 1-4.74-1.3l-.34-.2-3.68.96.98-3.59-.22-.37a9.28 9.28 0 0 1-1.42-4.92c0-5.14 4.19-9.32 9.34-9.32 2.49 0 4.83.97 6.59 2.73a9.25 9.25 0 0 1 2.73 6.6c0 5.14-4.19 9.31-9.23 9.41Zm5.4-6.98c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
        </svg>
        Chat on WhatsApp
      </a>


      {ready && (
        <SettingsPanel
          showVideo={settings.showVideo}
          onToggleVideo={() => update({ showVideo: !settings.showVideo })}
        />
      )}
    </div>
  );
}

function SocialIcons() {
  const socials = [
    { href: "https://facebook.com/pointstudio", label: "Facebook", d: "M13 22v-8h3l1-4h-4V7.5c0-1.1.3-1.9 1.9-1.9H17V2.1C16.7 2.1 15.6 2 14.3 2 11.7 2 10 3.6 10 6.7V10H7v4h3v8h3z" },
    { href: "https://instagram.com/pointstudio", label: "Instagram", d: "M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.9.2 2.3.4.6.2 1 .5 1.5 1s.8.9 1 1.5c.2.5.4 1.1.4 2.3.1 1.3.1 1.7.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.9-.4 2.3-.2.6-.5 1-1 1.5s-.9.8-1.5 1c-.5.2-1.1.4-2.3.4-1.3.1-1.7.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.9-.2-2.3-.4-.6-.2-1-.5-1.5-1s-.8-.9-1-1.5c-.2-.5-.4-1.1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c0-1.2.2-1.9.4-2.3.2-.6.5-1 1-1.5s.9-.8 1.5-1c.5-.2 1.1-.4 2.3-.4C8.4 2.2 8.8 2.2 12 2.2M12 0C8.7 0 8.3 0 7.1.1 5.8.1 5 .3 4.2.6c-.8.3-1.5.7-2.2 1.4C1.3 2.7.9 3.4.6 4.2.3 5 .1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.1.6 2.9.3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.6.5 2.9.6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.1-.3 2.9-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.6.6-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.1-.6-2.9-.3-.8-.7-1.5-1.4-2.2-.7-.7-1.4-1.1-2.2-1.4-.8-.3-1.6-.5-2.9-.6C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.9a1.4 1.4 0 100 2.9 1.4 1.4 0 000-2.9z" },
    { href: "https://pinterest.com/pointstudio", label: "Pinterest", d: "M12 0C5.4 0 0 5.4 0 12c0 5 3.1 9.4 7.5 11.1-.1-.9-.2-2.4 0-3.4.2-.9 1.4-5.8 1.4-5.8s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.7-2.2 3.7-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.3c-.1.2-.2.3-.4.2-1.5-.7-2.5-2.9-2.5-4.7 0-3.8 2.8-7.3 8-7.3 4.2 0 7.4 3 7.4 7 0 4.2-2.6 7.5-6.3 7.5-1.2 0-2.4-.6-2.8-1.4l-.8 2.9c-.3 1.1-1.1 2.5-1.6 3.4C9.6 23.8 10.8 24 12 24c6.6 0 12-5.4 12-12S18.6 0 12 0z" },
    { href: "https://linkedin.com/company/pointstudio", label: "LinkedIn", d: "M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3v9zM6.5 8.3a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM19 19h-3v-4.7c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5V19h-3v-9h2.9v1.2h.1a3.2 3.2 0 012.9-1.6c3.1 0 3.7 2 3.7 4.7V19z" },
    { href: "https://twitter.com/pointstudio", label: "Twitter", d: "M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 001.88-2.37 8.6 8.6 0 01-2.72 1.04A4.28 4.28 0 0016.11 4c-2.37 0-4.28 1.92-4.28 4.29 0 .34.04.67.11.99A12.14 12.14 0 013 5.15a4.29 4.29 0 001.33 5.72c-.7-.02-1.36-.21-1.94-.53v.05c0 2.08 1.48 3.81 3.44 4.2a4.3 4.3 0 01-1.93.07 4.28 4.28 0 004 2.98A8.6 8.6 0 012 19.54 12.13 12.13 0 008.56 21.5c7.88 0 12.19-6.53 12.19-12.19 0-.19 0-.37-.01-.56A8.7 8.7 0 0022.46 6z" },
  ];
  return (
    <div className="flex gap-4">
      {socials.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d={s.d} /></svg>
        </a>
      ))}
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
