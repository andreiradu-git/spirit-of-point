/**
 * Content pentru pagina /fotografie-culinara-bucuresti
 *
 * Editează liber acest fișier — atât manual, cât și prin prompt AI.
 * Textul rămâne mereu în limba română.
 *
 * Pentru a ascunde pagina din meniul/link-urile de navigare (dar
 * PĂSTRÂND-O accesibilă prin URL și indexabilă de Google), setează
 * `isVisibleInNav: false` mai jos. NU adăuga noindex.
 */

export type FaqItem = { q: string; a: string };

export type FotografieCulinaraContent = {
  /** Când e false, link-urile din footer / navigare NU se afișează,
   *  dar pagina rămâne live la URL și indexabilă de Google. */
  isVisibleInNav: boolean;

  seo: {
    title: string;
    description: string;
    keywords: string;
    ogImage: string;
  };

  h1: string;
  intro: string[];

  sections: Array<{
    h2: string;
    paragraphs?: string[];
    bullets?: string[];
    steps?: string[];
  }>;

  pretPornireDeLa: string;
  pretDetalii: string;

  faq: FaqItem[];

  cta: {
    h2: string;
    body: string;
    email: string;
    phone: string;
  };

  navLinkLabel: string;
};

export const fotografieCulinaraContent: FotografieCulinaraContent = {
  isVisibleInNav: true,

  seo: {
    title:
      "Fotografie Culinară București | Fotografie Food Profesională — Point Studio",
    description:
      "Studio de fotografie culinară și fotografie profesională în București. Fotografie food pentru restaurante, meniu, social media, Glovo, Tazz, Bolt Food.",
    keywords:
      "fotografie culinara Bucuresti, fotografie food, fotograf mancare, fotografie meniu restaurant, food photography Bucuresti, Glovo, Tazz, Bolt Food",
    ogImage:
      "https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/3236b78e-0c1c-48e9-83fd-bbfa1f67650f/LOGO_PSP.png?format=1500w",
  },

  h1: "Fotografie Culinară Profesională în București",

  intro: [
    "Point Studio este un studio de fotografie culinară și fotografie profesională din București, specializat în fotografie food pentru restaurante, cofetării, branduri și producători alimentari. Realizăm ședințe foto atât în studioul nostru din Piața Presei Libere, dotat cu bucătărie completă și recuzită proprie, cât și la locația clientului.",
    "Fotografiile noastre de mâncare sunt gândite pentru meniuri tipărite, social media, website și platformele de livrare — Glovo, Tazz, Bolt Food. Colaborăm cu food styliști, propși și alți profesioniști pentru ca fiecare preparat să arate exact așa cum merită.",
  ],

  sections: [
    {
      h2: "De ce fotografie profesională, nu poze făcute cu telefonul",
      paragraphs: [
        'Diferența dintre o poză făcută rapid cu telefonul și o fotografie profesională de mâncare se vede imediat în modul în care clientul decide ce comandă. Lumina controlată, compoziția gândită și editarea corectă a culorilor fac diferența dintre un preparat care pare apetisant și unul care trece neobservat într-un meniu online sau pe Instagram. Ca studio de fotografie profesională, ne asigurăm că fiecare imagine respectă identitatea vizuală a brandului tău, nu doar că "arată bine" izolat.',
      ],
    },
    {
      h2: "Ce includem într-o ședință de fotografie culinară",
      bullets: [
        "Consultanță inițială despre stilul dorit (pe alb, rustic, dark & moody, minimalist)",
        "Food styling — aranjarea preparatelor pentru cadru",
        "Recuzită proprie: farfurii, tacâmuri, fundaluri, textile",
        "Fotografiere în studio sau la locația restaurantului",
        "Editare profesională a tuturor imaginilor selectate",
        "Livrare în formate optimizate pentru meniu, social media și platforme de livrare",
      ],
    },
    {
      h2: "Pentru cine e potrivit",
      bullets: [
        "Restaurante și cofetării care vor poze de meniu sau social media",
        "Branduri alimentare (producători, ambalaje, campanii publicitare)",
        "Platforme de livrare — Glovo, Tazz, Bolt Food",
        "Hoteluri și cafenele care vor fotografie profesională pentru site și materiale de marketing",
      ],
    },
    {
      h2: "Cum decurge o ședință foto",
      steps: [
        "Ne scrii cu ce preparate/produse vrei fotografiate și unde vor fi folosite imaginile",
        "Stabilim data, locația (studio sau la tine) și stilul vizual",
        "Ședința foto propriu-zisă, cu food styling inclus",
        "Selectezi pozele preferate dintr-o galerie",
        "Livrăm imaginile editate, în formatele de care ai nevoie",
      ],
    },
  ],

  pretPornireDeLa: "[SUMA]",
  pretDetalii:
    "Prețul final depinde de numărul de preparate, locație (studio sau la tine) și dacă e nevoie de food stylist. Scrie-ne pentru o ofertă personalizată.",

  faq: [
    { q: "Cât durează o ședință foto?", a: "[DE COMPLETAT]" },
    {
      q: "Puteți veni la restaurantul nostru sau doar în studio?",
      a: "Ambele variante sunt posibile — atât în studioul nostru din Piața Presei Libere, cât și la locația ta.",
    },
    { q: "În cât timp primim pozele editate?", a: "[DE COMPLETAT]" },
  ],

  cta: {
    h2: "Cere o ofertă pentru fotografie culinară",
    body: "Scrie-ne la {email} sau sună la {phone}.",
    email: "andrei@pointstudio.ro",
    phone: "+40 744 341 286",
  },

  navLinkLabel:
    "Citește mai multe despre fotografie culinară în București →",
};
