import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import foodData from "@/data/food.json";
import peopleData from "@/data/people.json";
import editorialData from "@/data/editorial.json";
import corporateData from "@/data/work/corporate.json";
import landscapeData from "@/data/work/landscape.json";
import industrialData from "@/data/work/industrial.json";

type Img = { src: string; alt: string };

const WORK: Record<string, { title: string; data: Img[] }> = {
  food: { title: "Food", data: foodData as Img[] },
  people: { title: "People", data: peopleData as Img[] },
  editorial: { title: "Editorial", data: editorialData as Img[] },
  corporate: { title: "Corporate", data: corporateData as Img[] },
  landscape: { title: "Landscape", data: landscapeData as Img[] },
  industrial: { title: "Industrial", data: industrialData as Img[] },
};


export function WorkPage() {
  const { title, data } = Route.useLoaderData();
  return (
    <PortfolioPage
      slug={Route.useParams().slug}
      tagline={title}
      fallbackImages={data}
    />
  );
}
