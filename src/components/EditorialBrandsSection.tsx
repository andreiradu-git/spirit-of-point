import { Editable } from "./Editable";

/**
 * CMS-editable editorial context for the Editorial client-logo strip.
 * Text lives in site texts (EN plain key, RO `#ro`); defaults render in SSR.
 */
export function EditorialBrandsSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-10 md:pt-14 pb-6">
      <div className="text-[15px] leading-relaxed">
        <Editable id="editorial.brands.title" as="h2" className="mb-4 block font-serif text-3xl italic">
          From local brands to international names
        </Editable>
        <Editable id="editorial.brands.p1" as="p" multiline className="mb-4 block">
          Over the years, Point Studio has produced commercial, corporate, advertising and product photography for brands and companies across a wide range of industries. Our work includes projects for Lidl, Kaufland, Carrefour, McDonald’s, Costa Coffee, MOL, Hard Rock Cafe, Président, Dr. Oetker, Angst, Regina Maria, IOM, Praktiker, Transavia, Adevărul, Băneasa, Brico Dépôt, Mega Image / Delhaize and many other brands and companies.
        </Editable>
        <Editable id="editorial.brands.p2" as="p" multiline className="mb-4 block">
          Photography produced in our studio and on location has been used across advertising campaigns, corporate communications, brand materials, catalogues, publications, social media, websites and printed materials. From portraits and teams to workplaces, products, production processes and campaign imagery, each project is developed around the brand’s visual identity and communication needs.
        </Editable>
        <Editable id="editorial.brands.p3" as="p" multiline className="mb-4 block">
          Based in Bucharest, we also work on location throughout Romania, producing professional photography for commercial, editorial and corporate use across digital and print.
        </Editable>
      </div>
    </section>
  );
}
