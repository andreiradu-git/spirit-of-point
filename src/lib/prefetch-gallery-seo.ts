import type { QueryClient } from "@tanstack/react-query";
import { fetchAllGallerySeo } from "@/hooks/use-gallery-seo";
import { fetchTexts } from "@/hooks/use-site-texts";
import { getPublicGallerySeo } from "@/lib/gallery-seo-public.functions";

/**
 * Loads the CMS gallery text into the shared query cache during SSR so the
 * editorial/SEO text below galleries is in the initial HTML. Same queries as
 * the client hooks, so CMS edits show on the next request. Never blocks render.
 */
export async function prefetchGallerySeo(queryClient: QueryClient, requiredKey?: string): Promise<void> {
  await Promise.allSettled([
    queryClient.ensureQueryData({ queryKey: ["gallery-seo", "all"], queryFn: fetchAllGallerySeo, staleTime: 60_000 }),
    queryClient.ensureQueryData({ queryKey: ["site-texts"], queryFn: fetchTexts, staleTime: 60_000 }),
  ]);

  if (!requiredKey) return;

  let required: Awaited<ReturnType<typeof getPublicGallerySeo>> | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      required = await getPublicGallerySeo({ data: { key: requiredKey } });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
    }
  }
  if (!required) throw lastError instanceof Error ? lastError : new Error("Required gallery SEO failed to load");

  queryClient.setQueryData(["gallery-seo", "all"], (current: Record<string, unknown> | undefined) => ({
    ...(current ?? {}),
    [requiredKey]: required,
  }));
}
