import { PortfolioPage } from "@/components/PortfolioPage";
import { Editable } from "@/components/Editable";
import data from "@/data/wanders.json";

const LONG_DESCRIPTION = "Some images are not made to sell a story — they surface on their own, when the eye stops looking for something and starts simply seeing. This is where that happens. Away from the discipline of a brief, these photographs follow no client, no product, no plan — only what quietly pulls at something inside. Some belong to no series at all; others have found their way into personal artistic projects, exhibited or kept close. Together, they are less a portfolio than a trace — of what moves us, unguarded, when the camera becomes a way of listening rather than showing.";

export function WandersPage() {

  return (
    <>
      <PortfolioPage
        slug="wanders"
        tagline="Moments woven into personal, artistic work."
        taglineId="wanders.description"
        fallbackImages={data}
        galleryLayout="archive"
      />
      <section className="mx-auto max-w-3xl px-6 pb-24 -mt-12 md:-mt-16">
        <Editable id="wanders.longDescription" as="p" multiline className="text-sm md:text-base leading-7 text-muted-foreground block">
          {LONG_DESCRIPTION}
        </Editable>
      </section>
    </>
  );
}
