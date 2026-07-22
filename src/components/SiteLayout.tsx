import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/food", label: "Food" },
  { to: "/patterns", label: "Patterns" },
  { to: "/people", label: "People" },
  { to: "/editorial", label: "Editorial" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-serif text-lg tracking-[0.25em] uppercase">
            Point Studio
          </Link>
          <nav className="hidden md:flex gap-8 text-xs uppercase tracking-[0.2em]">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`transition-colors hover:text-foreground ${
                  path === n.to ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-xs uppercase tracking-widest"
            aria-label="Menu"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-border px-6 py-4 flex flex-col gap-3 text-sm uppercase tracking-[0.2em]">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

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
    </div>
  );
}

export function cdn(url: string, w = 1500) {
  return `${url}?format=${w}w`;
}
