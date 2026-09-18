import type { Lang } from "@/i18n";

export type VideoFaqItem = {
  question: string;
  answer: string;
};

export type VideoPageContent = {
  title: string;
  description: string;
  h1: string;
  intro: string;
  h2: string;
  body: string;
  faqHeading: string;
  faq: VideoFaqItem[];
};

export const VIDEO_PAGE_CONTENT: Record<Lang, VideoPageContent> = {
  en: {
    title: "Video Production Bucharest | Commercial & Food Video | Point Studio",
    description:
      "Commercial video production in Bucharest for food, products and brands. Cinematic filming, lighting and post-production by Point Studio.",
    h1: "Commercial Video Production in Bucharest",
    intro:
      "Point Studio creates commercial video content for brands, advertising and digital campaigns. Based in Bucharest, we produce food, product and branded video, from concept and filming to editing and post-production.",
    h2: "Food, Product & Commercial Video",
    body:
      "Our video work combines cinematography, controlled lighting and precise art direction, with a strong focus on food and product imagery. We create short-form advertising, branded content and social media video for agencies and brands in Romania and internationally.",
    faqHeading: "Video production FAQ",
    faq: [
      {
        question: "What types of video production do you offer?",
        answer:
          "We produce commercial video for brands and agencies, including food video, product video, branded content, advertising campaigns, social media content and corporate video.",
      },
      {
        question: "Do you provide video production in Bucharest, across Romania and internationally?",
        answer:
          "Yes. Point Studio is based in Bucharest, and productions can take place in our studio, at the client's location, elsewhere in Romania or internationally, depending on the project.",
      },
      {
        question: "Do you handle concept development, filming and editing?",
        answer:
          "Yes. Depending on the project, we can handle the complete production process, from concept and pre-production to filming, editing, color grading and final delivery.",
      },
      {
        question: "Do you produce food and product videos?",
        answer:
          "Yes. Food and product are two of our main visual specialties. Photography and video production can also be combined within the same campaign to maintain a consistent visual direction.",
      },
      {
        question: "Do you create video content for social media?",
        answer:
          "Yes. We can produce content in formats and durations adapted for Instagram, TikTok, YouTube and other digital platforms, including vertical and horizontal versions.",
      },
    ],
  },
  ro: {
    title: "Producție Video București | Video Comercial & Food | Point Studio",
    description:
      "Producție video comercială în București pentru branduri, food și produse. Filmare, lighting, montaj și post-producție realizate de Point Studio.",
    h1: "Producție video comercială în București",
    intro:
      "Point Studio realizează producție video comercială pentru branduri, campanii de publicitate și conținut digital. Filmăm proiecte de food, produs și branded content, de la concept și filmare până la montaj și post-producție, în București, în România și internațional.",
    h2: "Video food, produs și publicitate",
    body:
      "Punem accent pe imagine, lumină și art direction, cu experiență în special în zona de food și product. Realizăm spoturi scurte, branded content și materiale video pentru social media, agenții și branduri din România și din afara țării.",
    faqHeading: "Întrebări despre producția video",
    faq: [
      {
        question: "Ce tipuri de producție video realizați?",
        answer:
          "Realizăm producție video comercială pentru branduri și agenții: food video, product video, branded content, materiale pentru campanii, social media și prezentări corporate.",
      },
      {
        question: "Realizați producții video în București, în România și internațional?",
        answer:
          "Da. Point Studio este în București, iar filmările pot avea loc în studio, în locația clientului sau în alte locații din România și din afara țării, în funcție de proiect.",
      },
      {
        question: "Vă ocupați și de concept, filmare și montaj?",
        answer:
          "Da. În funcție de proiect, putem acoperi întregul proces, de la concept și pregătirea filmării până la filmare, montaj, colorizare și livrarea materialelor finale.",
      },
      {
        question: "Realizați video pentru food și produse?",
        answer:
          "Da. Food și product sunt două dintre principalele noastre direcții vizuale. Putem integra fotografia și producția video în aceeași campanie, păstrând o direcție vizuală coerentă.",
      },
      {
        question: "Realizați conținut video pentru social media?",
        answer:
          "Da. Putem produce materiale în formate și durate adaptate pentru Instagram, TikTok, YouTube și alte platforme digitale, inclusiv variante verticale și orizontale.",
      },
    ],
  },
};

export function videoWebPageJsonLd(lang: Lang, url: string) {
  const content = VIDEO_PAGE_CONTENT[lang];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: content.h1,
    description: content.description,
    url,
    inLanguage: lang === "ro" ? "ro-RO" : "en",
  };
}

export function videoFaqJsonLd(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: VIDEO_PAGE_CONTENT[lang].faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}