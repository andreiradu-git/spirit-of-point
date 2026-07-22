import { cdn } from "./SiteLayout";
import home from "@/data/home.json";

const logos = home.filter(
  (i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src),
);

export function ClientLogos() {
  if (logos.length === 0) return null;
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 md:py-5">
        <div className="flex flex-wrap md:flex-nowrap justify-center md:justify-between items-center gap-x-4 gap-y-3">
          {logos.map((l) => (
            <img
              key={l.src}
              src={cdn(l.src, 200)}
              alt="Client logo"
              className="h-7 md:h-8 w-auto object-contain opacity-80 hover:opacity-100 transition shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
