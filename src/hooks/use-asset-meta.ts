import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

export type AssetMetaMap = Record<string, { label: string | null; alt: string | null }>;

async function fetchAll(): Promise<AssetMetaMap> {
  const { data, error } = await db.from("asset_meta").select("url, label, alt");
  if (error) throw error;
  const map: AssetMetaMap = {};
  for (const row of (data ?? []) as Array<{ url: string; label: string | null; alt: string | null }>) {
    map[row.url] = { label: row.label, alt: row.alt };
  }
  return map;
}

export function useAssetMeta() {
  return useQuery({ queryKey: ["asset-meta"], queryFn: fetchAll, staleTime: 60_000 });
}

export function useInvalidateAssetMeta() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["asset-meta"] });
}
