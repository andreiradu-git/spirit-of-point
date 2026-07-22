import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import data from "@/data/contact.json";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — Point Studio" },
      {
        name: "description",
        content:
          "Get in touch with Point Studio in Bucharest — andrei@pointstudio.ro, +40 744 341 286.",
      },
      { property: "og:title", content: "Contact — Point Studio" },
      { property: "og:description", content: "Contact Point Studio, Bucharest." },
    ],
  }),
});

function ContactPage() {
  const bg = data.find((d) => /jpg|jpeg/i.test(d.src)) || data[0];
  return (
    <SiteLayout>
      <section className="relative min-h-[70vh] w-full flex items-center">
        {bg && (
          <>
            <img
              src={cdn(bg.src, 2000)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/55" />
          </>
        )}
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-white text-center w-full">
          <p className="text-xs uppercase tracking-[0.4em] mb-6 opacity-80">Get in touch</p>
          <h1 className="font-serif text-5xl md:text-6xl mb-10">Let's create together.</h1>
          <div className="space-y-4 text-lg">
            <div>
              <a href="mailto:andrei@pointstudio.ro" className="underline underline-offset-4">
                andrei@pointstudio.ro
              </a>
            </div>
            <div>
              <a href="tel:+40744341286">+40 744 341 286</a>
            </div>
            <div className="pt-6 text-sm opacity-80 leading-relaxed">
              Piața Presei Libere 1<br />
              Casa Presei Libere — Building Corp A2, et. 3<br />
              part of Atelierele Scânteia · Bucharest, Romania
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
