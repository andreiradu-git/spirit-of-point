import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout, cdn } from "@/components/SiteLayout";
import videos from "@/data/videos.json";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useAssetMeta, useInvalidateAssetMeta } from "@/hooks/use-asset-meta";
import { useServerFn } from "@tanstack/react-start";
import { saveAssetMeta, generateAssetMeta } from "@/lib/asset-meta.functions";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/video")({
  component: VideoPage,
  head: () => ({
    meta: [
      { title: "Video Production & Motion — Point Studio Bucharest" },
      {
        name: "description",
        content:
          "Commercial video production, motion and reels by Point Studio — Bucharest photo & video studio.",
      },
      {
        name: "keywords",
        content: "video production Bucharest, commercial video, motion photography, product video, advertising video",
      },
      { property: "og:title", content: "Video Production — Point Studio" },
      { property: "og:description", content: "Motion, reels and video productions by Point Studio." },
      { property: "og:image", content: cdn(videos[0].poster, 1600) },
      { name: "twitter:image", content: cdn(videos[0].poster, 1600) },
    ],
  }),
});

function VideoPage() {
  const [active, setActive] = useState<number | null>(null);
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const { data: metaMap = {} } = useAssetMeta();
  const editable = isAdmin && editMode;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((v, i) => {
            const meta = metaMap[v.poster];
            const label = meta?.label || v.title;
            const alt = meta?.alt || v.title;
            return (
              <div key={i} className="flex flex-col gap-2">
                <button
                  onClick={() => v.src && setActive(i)}
                  className="group relative aspect-video overflow-hidden bg-neutral-900 text-left"
                >
                  <img
                    src={cdn(v.poster, 1400)}
                    alt={alt}
                    className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100 transition"
                  />
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center text-black text-2xl">
                      ▶
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <div className="font-serif text-2xl">{label}</div>
                    {!v.src && (
                      <div className="text-[10px] uppercase tracking-widest text-white/70 mt-1">
                        Coming soon
                      </div>
                    )}
                  </div>
                </button>
                {editable && <VideoMetaEditor url={v.poster} initialLabel={label} initialAlt={alt} />}
              </div>
            );
          })}
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

function VideoMetaEditor({ url, initialLabel, initialAlt }: { url: string; initialLabel: string; initialAlt: string }) {
  const save = useServerFn(saveAssetMeta);
  const generate = useServerFn(generateAssetMeta);
  const invalidate = useInvalidateAssetMeta();
  const [label, setLabel] = useState(initialLabel);
  const [alt, setAlt] = useState(initialAlt);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const doSave = async (nextLabel = label, nextAlt = alt) => {
    setSaving(true);
    try {
      await save({ data: { url, label: nextLabel || null, alt: nextAlt || null } });
      invalidate();
    } catch (e) {
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const doAi = async () => {
    setAiBusy(true);
    try {
      const out = await generate({ data: { imageUrl: url, context: "Video showreel poster", kind: "image" } });
      if (out.label) setLabel(out.label);
      if (out.alt) setAlt(out.alt);
      await doSave(out.label || label, out.alt || alt);
    } catch (e) {
      alert("AI error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="bg-white border border-blue-400/60 border-dashed rounded p-2 flex flex-col gap-1.5 text-xs">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => doSave()}
        placeholder="Video label"
        className="border rounded px-2 py-1"
      />
      <textarea
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        onBlur={() => doSave()}
        rows={2}
        placeholder="Alt text"
        className="border rounded px-2 py-1 resize-y"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doAi}
          disabled={aiBusy || saving}
          className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI write label + alt
        </button>
        {saving && <span className="text-[10px] text-neutral-500 self-center">Saving…</span>}
      </div>
    </div>
  );
}
