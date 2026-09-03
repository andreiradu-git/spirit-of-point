import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/people.json";


export function PeoplePage() {
  return <PortfolioPage slug="people" tagline="Portrait, Fashion & Business Photography" fallbackImages={data} />;
}
