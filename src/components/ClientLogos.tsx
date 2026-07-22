import { cdn } from "./SiteLayout";
import home from "@/data/home.json";

const logos = home.filter(
  (i) => /logo|Kaufland/i.test(i.src) && !/LOGO_PSP/i.test(i.src),
);

export function ClientLogos() {
  if (logos.length === 0) return null;
  return (
    <section className="border-t border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
        <div className="flex md:flex-nowrap flex-wrap justify-center items-center gap-x-6 md:gap-x-4 gap-y-4">
          {logos.map((l) => (
            <img
              key={l.src}
              src={cdn(l.src, 200)}
              alt="Client logo"
              className="h-6 md:h-7 w-auto object-contain opacity-80 hover:opacity-100 transition shrink-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
