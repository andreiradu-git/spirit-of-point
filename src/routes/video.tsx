import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import videos from "@/data/videos.json";

export const Route = createFileRoute("/video")({
  component: VideoPage,
  head: () => ({
    meta: [
      { title: "Video — Point Studio" },
      {
        name: "description",
        content:
          "Video productions and motion work by Point Studio — Bucharest photo & video studio.",
      },
      { property: "og:title", content: "Video — Point Studio" },
      { property: "og:description", content: "Motion, reels and video productions by Point Studio." },
      { property: "og:image", content: cdn(videos[0].poster, 1600) },
      { name: "twitter:image", content: cdn(videos[0].poster, 1600) },
    ],
  }),
});

function VideoPage() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mb-4">
          Motion & video productions
        </p>
        <h1 className="font-serif text-5xl md:text-6xl">Video</h1>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((v, i) => (
            <button
              key={i}
              onClick={() => v.src && setActive(i)}
              className="group relative aspect-video overflow-hidden bg-neutral-900 text-left"
            >
              <img
                src={cdn(v.poster, 1400)}
                alt={v.title}
                className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 transition"
              />
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center text-black text-2xl">
                  ▶
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="font-serif text-2xl">{v.title}</div>
                {!v.src && (
                  <div className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                    Coming soon
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {active !== null && videos[active].src && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <button
            className="absolute top-4 right-6 text-white text-sm uppercase tracking-widest"
            onClick={() => setActive(null)}
          >
            Close
          </button>
          <video
            src={videos[active].src}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </SiteLayout>
  );
}
