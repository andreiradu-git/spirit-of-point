import { useState } from "react";
import { Editable } from "@/components/Editable";
import { useAdmin } from "@/hooks/use-admin";
import { useEditMode } from "@/hooks/use-edit-mode";
import { useText, useSaveText } from "@/hooks/use-site-texts";

const URL_ID = "press.url";
const DEFAULT_URL =
  "https://www.iqads.ro/articol/76853/andrei-radu-nu-se-poate-face-nimic-repede-ieftin-si-bun-poti-compromite-doar-una";

/**
 * Minimal editorial press mention. All copy is CMS-editable per language
 * (via `Editable`), and the target URL is stored as a site text so a future
 * press appearance can replace this one without a code change.
 */
export function PressBlock() {
  const { isAdmin } = useAdmin();
  const { editMode } = useEditMode();
  const url = useText(URL_ID, DEFAULT_URL);
  const saveText = useSaveText();
  const [draft, setDraft] = useState<string | null>(null);
  const editable = isAdmin && editMode;

  return (
    <section aria-label="Press" className="pb-16 md:pb-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="md:grid md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7 md:col-start-6">
            <Editable
              as="div"
              id="press.label"
              className="type-eyebrow text-muted-foreground mb-4 block"
            >
              FEATURED / IQADS
            </Editable>

            <h2 className="type-editorial text-2xl md:text-3xl lg:text-4xl text-foreground break-words">
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="transition-opacity hover:opacity-70"
              >
                <Editable as="span" id="press.title" multiline>
                  {"Andrei Radu: “Nu se poate face nimic repede, ieftin și bun. Poți compromite doar una.”"}
                </Editable>
              </a>
            </h2>

            <Editable
              as="p"
              id="press.description"
              multiline
              className="mt-4 type-body-lg text-foreground/80 block"
            >
              A conversation about commercial photography, Point Studio, working with agencies and how the photographer’s profession has changed.
            </Editable>

            <p className="mt-6">
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="type-cta text-foreground border-b border-foreground/30 pb-1 transition-colors hover:border-foreground"
              >
                <Editable as="span" id="press.cta">
                  READ THE INTERVIEW ↗
                </Editable>
              </a>
            </p>

            {editable && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Article URL
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
                    await saveText(URL_ID, draft.trim());
                    setDraft(null);
                  }}
                  className="rounded bg-foreground px-2 py-1 text-xs text-background"
                >
                  Save URL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
