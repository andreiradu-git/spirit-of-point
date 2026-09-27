import type { QueryClient } from "@tanstack/react-query";
import { fetchAllGallerySeo } from "@/hooks/use-gallery-seo";
import { fetchTexts } from "@/hooks/use-site-texts";

/**
 * Loads the CMS gallery text into the shared query cache during SSR so the
 * editorial/SEO text below galleries is in the initial HTML. Same queries as
 * the client hooks, so CMS edits show on the next request. Never blocks render.
 */
export async function prefetchGallerySeo(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.ensureQueryData({ queryKey: ["gallery-seo", "all"], queryFn: fetchAllGallerySeo, staleTime: 60_000 }),
    queryClient.ensureQueryData({ queryKey: ["site-texts"], queryFn: fetchTexts, staleTime: 60_000 }),
  ]).catch(() => undefined);
}
