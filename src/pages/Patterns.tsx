import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/patterns.json";


export function PatternsPage() {
  return <PortfolioPage slug="patterns" tagline="Patterns, Textures & Closeups" fallbackImages={data} galleryLayout="stacked" />;
}

