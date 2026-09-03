import { Link } from "@tanstack/react-router";
import { PortfolioPage } from "@/components/PortfolioPage";
import data from "@/data/food.json";
import { fotografieCulinaraContent } from "@/data/fotografie-culinara";
import { useSiteSettings } from "@/hooks/use-site-settings";


export function FoodPage() {
  const { settings, ready } = useSiteSettings();
  const showLink = ready && settings.showFotografieCulinara && fotografieCulinaraContent.isVisibleInNav;
  return (
    <>
      <PortfolioPage slug="food" tagline="Food, Product & Tabletop Photography" fallbackImages={data} />
      {showLink && (
        <div className="mx-auto max-w-3xl px-6 pb-10 text-center">
          <Link
            to="/fotografie-culinara-bucuresti"
            className="inline-block text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
          >
            {fotografieCulinaraContent.navLinkLabel}
          </Link>
        </div>
      )}
    </>
  );
}
