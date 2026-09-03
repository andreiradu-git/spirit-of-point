import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

const LIST_PREFIX = "list.";

type SettingRow = { key: string; value: unknown };

async function fetchLists(): Promise<Record<string, unknown[]>> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", `${LIST_PREFIX}%`);
  if (error) throw error;
  const map: Record<string, unknown[]> = {};
  for (const row of (data ?? []) as SettingRow[]) {
    const id = row.key.slice(LIST_PREFIX.length);
    const v = row.value as { items?: unknown[] } | unknown[] | null;
    if (Array.isArray(v)) map[id] = v;
    else if (v && Array.isArray(v.items)) map[id] = v.items;
  }
  return map;
}

export function useSiteLists() {
  return useQuery({
    queryKey: ["site-lists"],
    queryFn: fetchLists,
    staleTime: 60_000,
  });
}

export function useList<T = unknown>(id: string, fallback: T[]): T[] {
  const { data } = useSiteLists();
  const stored = data?.[id];
  if (!stored) return fallback;
  return stored as T[];
}

export function useSaveList() {
  const qc = useQueryClient();
  return async <T,>(id: string, items: T[]) => {
    const key = `${LIST_PREFIX}${id}`;
    const value = { items } as unknown as Record<string, unknown>;
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: value as never }, { onConflict: "key" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["site-lists"] });
  };
}
