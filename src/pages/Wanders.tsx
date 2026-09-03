import { useEffect, useState } from "react";
import { PortfolioPage } from "@/components/PortfolioPage";
import { Editable } from "@/components/Editable";
import data from "@/data/wanders.json";
import { useLang, useTr } from "@/i18n";

export function WandersPage() {
  const lang = useLang();
  const t = useTr();
  const [longDescription, setLongDescription] = useState("");
  const defaultLongDescription = lang === "ro"
    ? "Unele imagini nu sunt făcute ca să vândă o poveste — apar de la sine, atunci când privirea încetează să caute ceva și începe pur și simplu să vadă. Aici se întâmplă asta. Departe de disciplina unui brief, aceste fotografii nu urmează niciun client, niciun produs, niciun plan — doar ceea ce, în tăcere, atinge ceva înăuntru. Unele nu aparțin niciunei serii anume; altele și-au găsit locul în proiecte artistice personale, expuse sau păstrate aproape. Împreună, sunt mai puțin un portofoliu și mai degrabă o urmă — a ceea ce ne mișcă, fără apărare, atunci când aparatul de fotografiat devine un mod de a asculta, nu de a arăta."
    : "Some images are not made to sell a story — they surface on their own, when the eye stops looking for something and starts simply seeing. This is where that happens. Away from the discipline of a brief, these photographs follow no client, no product, no plan — only what quietly pulls at something inside. Some belong to no series at all; others have found their way into personal artistic projects, exhibited or kept close. Together, they are less a portfolio than a trace — of what moves us, unguarded, when the camera becomes a way of listening rather than showing.";

  useEffect(() => setLongDescription(defaultLongDescription), [defaultLongDescription]);

  return (
    <>
      <PortfolioPage
        slug="wanders"
        tagline="Moments woven into personal, artistic work."
        taglineId="wanders.description"
        fallbackImages={data}
        galleryLayout="archive"
      />
      <section className="mx-auto max-w-3xl px-6 pb-24 -mt-12 md:-mt-16">
        <Editable id="wanders.longDescription" as="p" multiline className="text-sm md:text-base leading-7 text-muted-foreground block">
          {longDescription}
        </Editable>
      </section>
    </>
  );
}
