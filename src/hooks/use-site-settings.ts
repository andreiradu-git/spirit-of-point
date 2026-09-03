import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { db } from "@/lib/cms-client";
import {
  SITE_FLAGS_KEY,
  SITE_FLAG_DEFAULTS,
  fetchSiteFlags,
  type SiteSettings,
} from "@/lib/site-flags";

export type { SiteSettings } from "@/lib/site-flags";
export { SITE_FLAGS_KEY } from "@/lib/site-flags";

const rootApi = getRouteApi("__root__");

/**
 * Public visibility flags.
 *
 * The values are resolved in the root loader, so they are already correct
 * during SSR and are handed to react-query as `initialData`. That removes the
 * old SSR/hydration split where the server rendered one visibility state and
 * the browser flipped to another once the query resolved.
 */
export function useSiteSettings() {
  const qc = useQueryClient();
  const rootData = rootApi.useLoaderData() as { siteFlags?: SiteSettings | null } | undefined;
  const initial = rootData?.siteFlags ?? undefined;

  const query = useQuery({
    queryKey: ["site-flags"],
    queryFn: fetchSiteFlags,
    staleTime: 30_000,
    ...(initial ? { initialData: initial } : {}),
  });

  const settings = query.data ?? SITE_FLAG_DEFAULTS;
  const ready = query.isSuccess || !!initial;

  const update = async (patch: Partial<SiteSettings>) => {
    const next = { ...settings, ...patch };
    qc.setQueryData(["site-flags"], next);
    const { error } = await db
      .from("site_settings")
      .upsert({ key: SITE_FLAGS_KEY, value: next as unknown as never }, { onConflict: "key" });
    if (error) {
      await qc.invalidateQueries({ queryKey: ["site-flags"] });
      throw error;
    }
    await qc.invalidateQueries({ queryKey: ["site-flags"] });
  };

  return { settings, update, ready };
}
