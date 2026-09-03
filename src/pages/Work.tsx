import { PortfolioPage } from "@/components/PortfolioPage";
import foodData from "@/data/food.json";
import peopleData from "@/data/people.json";
import editorialData from "@/data/editorial.json";
import corporateData from "@/data/work/corporate.json";
import landscapeData from "@/data/work/landscape.json";
import industrialData from "@/data/work/industrial.json";
import { useTr } from "@/i18n";

export type Img = { src: string; alt: string };

export const WORK: Record<string, { title: string; data: Img[] }> = {
  food: { title: "Food", data: foodData as Img[] },
  people: { title: "People", data: peopleData as Img[] },
  editorial: { title: "Editorial", data: editorialData as Img[] },
  corporate: { title: "Corporate", data: corporateData as Img[] },
  landscape: { title: "Landscape", data: landscapeData as Img[] },
  industrial: { title: "Industrial", data: industrialData as Img[] },
};

/** Shared loader body for both the English and Romanian work routes. */
export function resolveWork(slug: string): { title: string; data: Img[] } | null {
  const w = WORK[slug];
  if (w) return w;
  // Any gallery created in the CMS resolves here without code changes.
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const title = slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return { title, data: [] as Img[] };
}

export function WorkPage({ slug, title, data }: { slug: string; title: string; data: Img[] }) {
  const t = useTr();
  return <PortfolioPage slug={slug} tagline={t(title)} fallbackImages={data} />;
}
