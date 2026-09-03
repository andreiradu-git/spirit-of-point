import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Editable } from "@/components/Editable";
import { useSocials, SOCIAL_ICON_PATHS } from "@/hooks/use-socials";
import { useAdmin } from "@/hooks/use-admin";
import { fotografieCulinaraContent } from "@/data/fotografie-culinara";
import { useLang, useTr, localizePath, tr } from "@/i18n";

function FotografieCulinaraFooterLink({ visible }: { visible: boolean }) {
  if (!visible || !fotografieCulinaraContent.isVisibleInNav) return null;
  return (
    <Link
      to="/fotografie-culinara-bucuresti"
      className="mt-2 block text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
    >
      {fotografieCulinaraContent.navLinkLabel}
    </Link>
  );
}



const BASE_NAV = [
  { to: "/", label: "Home" },
  { to: "/food", label: "Food" },
  { to: "/people", label: "People" },
  { to: "/editorial", label: "Editorial" },
  { to: "/contact", label: "Contact" },
] as const;

type NavItem = { to: string; label: string };

export function SiteLayout({
  children,
  transparentHeader = false,
  headerTone = "dark",
  flushFooter = false,
}: {
  children: ReactNode;
  transparentHeader?: boolean;
  headerTone?: "dark" | "light";
  flushFooter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { settings, update, ready } = useSiteSettings();
  const { isAdmin } = useAdmin();
  const lang = useLang();
  const t = useTr();


  const nav: NavItem[] = BASE_NAV.map((n) => ({ ...n }));
  if (settings.showPatterns) {
    nav.splice(2, 0, { to: "/patterns", label: "Patterns" });
  }
  if (settings.showVideo) {
    // insert Video before Contact
    nav.splice(nav.length - 1, 0, { to: "/video", label: "Video" });
  }

  const localizedNav: NavItem[] = nav.map((n) => ({
    to: localizePath(n.to, lang),
    label: tr(lang, n.label),
  }));

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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 sm:h-20 md:h-24 flex items-center justify-between gap-3">
          <Link to={localizePath("/", lang)} className="flex items-center shrink-0" aria-label="Point Studio">
            <img
              src="https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/3236b78e-0c1c-48e9-83fd-bbfa1f67650f/LOGO_PSP.png?format=400w"
              alt="Point Studio"
              className="h-10 sm:h-12 md:h-14 lg:h-16 xl:h-[69px] w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <nav className="flex gap-8 text-xs uppercase tracking-[0.2em]">
              {localizedNav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`transition-colors ${path === n.to ? textActive : textIdle}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <LangSwitch light={light} />
            <HeaderSocials light={light} />
          </div>
          <button
            onClick={() => setOpen(!open)}
            className={`md:hidden text-xs uppercase tracking-widest ${light ? "text-white" : ""}`}
            aria-label="Menu"
          >
            {open ? t("Close") : t("Menu")}
          </button>
        </div>
        {open && (
          <nav
            className={`md:hidden px-6 py-4 flex flex-col gap-3 text-sm uppercase tracking-[0.2em] ${
              light ? "bg-black/70 text-white" : "border-t border-border bg-background"
            }`}
          >
            {localizedNav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ))}
            <LangSwitch light={light} className="pt-1" />
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-6 pt-4 pb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6 text-sm text-muted-foreground">
          <div>
            <Editable as="div" id="footer.brand" className="font-serif text-xl text-foreground block">Point Studio</Editable>
            <Editable as="p" id="footer.tagline" multiline className="mt-2 max-w-sm italic block">
              First and foremost, we love what we do.
            </Editable>
          </div>
          <div className="space-y-1">
            <Editable as="div" id="footer.email" className="block">andrei@pointstudio.ro</Editable>
            <Editable as="div" id="footer.phone" className="block">+40 744 341 286</Editable>
            <Editable as="div" id="footer.address" className="block">Piața Presei Libere 1, Bucharest</Editable>
            <FotografieCulinaraFooterLink visible={settings.showFotografieCulinara} />
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <SocialIcons />
            <Editable as="div" id="footer.copyright" className="block">{`© ${new Date().getFullYear()} Point Studio`}</Editable>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/40744341286"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 h-11 w-11 rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-105 flex items-center justify-center"
        aria-label={t("Chat on WhatsApp")}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.02 0C5.4 0 .04 5.36.04 11.98c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.62a11.94 11.94 0 0 0 5.82 1.48h.01c6.62 0 11.98-5.36 11.98-11.98 0-3.2-1.25-6.21-3.49-8.4ZM12.03 21.3h-.01a9.3 9.3 0 0 1-4.74-1.3l-.34-.2-3.68.96.98-3.59-.22-.37a9.28 9.28 0 0 1-1.42-4.92c0-5.14 4.19-9.32 9.34-9.32 2.49 0 4.83.97 6.59 2.73a9.25 9.25 0 0 1 2.73 6.6c0 5.14-4.19 9.31-9.23 9.41Zm5.4-6.98c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
        </svg>
      </a>


      {ready && isAdmin && (
        <SettingsPanel
          showVideo={settings.showVideo}
          onToggleVideo={() => update({ showVideo: !settings.showVideo })}
          showPatterns={settings.showPatterns}
          onTogglePatterns={() => update({ showPatterns: !settings.showPatterns })}
          showTestimonials={settings.showTestimonials}
          onToggleTestimonials={() => update({ showTestimonials: !settings.showTestimonials })}
          showFotografieCulinara={settings.showFotografieCulinara}
          onToggleFotografieCulinara={() => update({ showFotografieCulinara: !settings.showFotografieCulinara })}
        />
      )}
    </div>
  );
}


function SocialIcons({ className = "", iconClass = "h-4 w-4" }: { className?: string; iconClass?: string }) {
  const { socials } = useSocials();
  const list = socials.filter((s) => s.enabled !== false && s.href);
  return (
    <div className={`flex gap-4 ${className}`}>
      {list.map((s) => (
        <a key={s.label + s.icon} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="transition-opacity hover:opacity-70">
          <svg viewBox="0 0 24 24" className={`${iconClass} fill-current`}><path d={SOCIAL_ICON_PATHS[s.icon]} /></svg>
        </a>
      ))}
    </div>
  );
}

/** Remembers the visitor's manual choice; never used to auto-redirect. */
function rememberLang(next: "en" | "ro") {
  try {
    window.localStorage.setItem("point-studio-lang", next);
  } catch {
    /* storage unavailable */
  }
}

function LangSwitch({ light, className = "" }: { light: boolean; className?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const lang = useLang();
  const idle = light ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground";
  const active = light ? "text-white" : "text-foreground";
  return (
    <div className={`flex items-center gap-1 text-xs uppercase tracking-[0.2em] ${className}`}>
      <Link
        to={localizePath(path, "en")}
        onClick={() => rememberLang("en")}
        aria-label="English"
        className={`transition-colors ${lang === "en" ? active : idle}`}
      >
        EN
      </Link>
      <span className={light ? "text-white/40" : "text-muted-foreground/50"}>/</span>
      <Link
        to={localizePath(path, "ro")}
        onClick={() => rememberLang("ro")}
        aria-label="Română"
        className={`transition-colors ${lang === "ro" ? active : idle}`}
      >
        RO
      </Link>
    </div>
  );
}

function HeaderSocials({ light }: { light: boolean }) {
  return <SocialIcons className={light ? "text-white/80" : "text-foreground/70"} iconClass="h-4 w-4" />;
}


function SettingsPanel({
  showVideo,
  onToggleVideo,
  showPatterns,
  onTogglePatterns,
  showTestimonials,
  onToggleTestimonials,
  showFotografieCulinara,
  onToggleFotografieCulinara,
}: {
  showVideo: boolean;
  onToggleVideo: () => void;
  showPatterns: boolean;
  onTogglePatterns: () => void;
  showTestimonials: boolean;
  onToggleTestimonials: () => void;
  showFotografieCulinara: boolean;
  onToggleFotografieCulinara: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-50">
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
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Show Patterns in menu</span>
            <input
              type="checkbox"
              checked={showPatterns}
              onChange={onTogglePatterns}
              className="h-4 w-4 accent-foreground"
            />
          </label>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Show Testimonials</span>
            <input
              type="checkbox"
              checked={showTestimonials}
              onChange={onToggleTestimonials}
              className="h-4 w-4 accent-foreground"
            />
          </label>
          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span>Show „Fotografie culinară” (RO)</span>
            <input
              type="checkbox"
              checked={showFotografieCulinara}
              onChange={onToggleFotografieCulinara}
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

export function cdn(url: string, w = 1500, quality = 75) {
  if (!url) return url;
  // Cloudflare R2 (images.pointstudio.ro) serves originals — no transform param
  // is applied. Widths/quality are ignored server-side by R2 itself; leaving
  // the URL untouched avoids polluting cache keys.
  if (/images\.pointstudio\.ro/.test(url)) {
    return url;
  }
  // Squarespace CDN
  if (/squarespace-cdn\.com/.test(url)) {
    const buckets = [100, 300, 500, 750, 1000, 1500, 2500];
    const bucket = buckets.find((b) => b >= w) ?? 2500;
    return `${url}?format=${bucket}w`;
  }
  return `${url}?format=${w}w&q=${quality}`;
}

export function cdnSrcSet(url: string, widths: number[] = [400, 800, 1200, 1600]) {
  return widths.map((w) => `${cdn(url, w)} ${w}w`).join(", ");
}
