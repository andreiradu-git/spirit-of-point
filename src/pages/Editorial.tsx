import { createFileRoute } from "@tanstack/react-router";
import { cdn } from "@/components/SiteLayout";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/editorial.json";


export function EditorialPage() {
  return (
    <PortfolioPage
      slug="editorial"
      tagline="Editorial & Printed Work"
      fallbackImages={data}
      showStrip
      showLogos
    />
  );
}

