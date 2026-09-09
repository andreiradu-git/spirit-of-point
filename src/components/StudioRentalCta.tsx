import { useState } from "react";
import { Editable } from "@/components/Editable";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText, useSaveText } from "@/hooks/use-site-texts";
import { useLang, textKey } from "@/i18n";

/**
 * Discreet studio-rental call to action shown at the end of "The Studio".
 *
 * Question and CTA copy are CMS-editable per language through `Editable`.
 * The destination URL is stored per language as a site text, so the Romanian
 * page always points at the Romanian rental site and the English page at the
 * English one — no automatic translation or redirect between them.
 */
const URL_ID = "studioRental.url";
const DEFAULT_URL: Record<"en" | "ro", string> = {
  en: "https://photostudiorental.ro/",
  ro: "https://studiofotodeinchiriat.ro/",
};

export function StudioRentalCta() {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const lang = useLang();
  const urlKey = textKey(URL_ID, lang);
  const url = useText(urlKey, DEFAULT_URL[lang]);
  const saveText = useSaveText();
  const [draft, setDraft] = useState<string | null>(null);
  const editable = isAdmin && editMode;

  return (
    <div className="mt-12 md:mt-16">
      <Editable
        as="p"
        id="studioRental.question"
        multiline
        className="text-[15px] md:text-base leading-relaxed text-foreground/80 block"
      >
        Need a space to bring your ideas to life?
      </Editable>

      <p className="mt-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs uppercase tracking-[0.25em] text-foreground border-b border-foreground/30 pb-1 transition-colors hover:border-foreground"
        >
          <Editable as="span" id="studioRental.cta">
            VIEW THE STUDIO &amp; AVAILABILITY ↗
          </Editable>
        </a>
      </p>

      {editable && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Rental URL ({lang.toUpperCase()})
          </label>
          <input
            type="url"
            value={draft ?? url}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 flex-1 rounded border border-blue-400/60 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              if (draft === null) return;
              await saveText(urlKey, draft.trim());
              setDraft(null);
            }}
            className="rounded bg-foreground px-2 py-1 text-xs text-background"
          >
            Save URL
          </button>
        </div>
      )}
    </div>
  );
}
