import { SiteLayout, cdn, cdnSrcSet, onTransformError } from "@/components/SiteLayout";
import { Editable } from "@/components/Editable";
import { useText } from "@/hooks/use-site-texts";
import { ContactForm } from "@/components/ContactForm";
import data from "@/data/contact.json";
import { useTr } from "@/i18n";
import { withoutBrandingAssets } from "@/lib/branding-assets";


export function ContactPage() {
  const t = useTr();
  // FD+Book58417.jpg (R2 original 9da6838c-…): the studio photograph that backs
  // the Contact hero. The Point Studio wordmark is branding and never used here.
  const photos = withoutBrandingAssets(data);
  const bg = photos.find((d) => d.src.includes("9da6838c-cccb-4ebc-a67c-979385654561")) || photos[0];
  const email = useText("contact.email", "andrei@pointstudio.ro");
  const phone = useText("contact.phone", "+40 744 341 286");
  const mapsQuery = useText(
    "contact.mapsQuery",
    "Casa Presei Libere, Piata Presei Libere 1, Bucharest",
  );
  return (
    <SiteLayout flushFooter>
      <section className="relative min-h-[70vh] w-full flex items-center">
        {bg && (
          <>
            <img
              src={cdn(bg.src, 2400)}
              srcSet={cdnSrcSet(bg.src, [800, 1200, 1600, 2400])}
              sizes="100vw"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={onTransformError}
            />
            <div className="absolute inset-0 bg-black/55" />
          </>
        )}
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-white text-center w-full">
          <Editable
            as="p"
            id="contact.eyebrow"
            className="text-xs uppercase tracking-[0.4em] mb-6 opacity-80 block"
          >
            Get in touch
          </Editable>
          <Editable
            as="h1"
            id="contact.title"
            className="font-serif text-5xl md:text-6xl mb-10 block"
          >
            Let's create together.
          </Editable>
          <div className="space-y-4 text-lg">
            <div>
              <a href={`mailto:${email}`} className="underline underline-offset-4">
                <Editable id="contact.email">{email}</Editable>
              </a>
            </div>
            <div>
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                <Editable id="contact.phone">{phone}</Editable>
              </a>
            </div>
            <Editable
              as="div"
              id="contact.address"
              multiline
              className="pt-6 text-sm opacity-80 leading-relaxed whitespace-pre-line block"
            >
              {"Piața Presei Libere 1\nCasa Presei Libere — Building Corp A2, et. 3\npart of Atelierele Scânteia · Bucharest, Romania"}
            </Editable>
          </div>
          <div className="mt-12">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="w-full">
        <iframe
          title={t("Point Studio location")}
          src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`}
          width="100%"
          height="450"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </section>
    </SiteLayout>
  );
}

