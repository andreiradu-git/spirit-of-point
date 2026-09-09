import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";
import { recordHistory } from "@/hooks/use-edit-history";

const LIST_PREFIX = "list.";

type SettingRow = { key: string; value: unknown };

async function fetchLists(): Promise<Record<string, unknown[]>> {
  const { data, error } = await db
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

async function writeList(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  items: unknown[] | null,
) {
  const key = `${LIST_PREFIX}${id}`;
  if (items === null) {
    const { error } = await db.from("site_settings").delete().eq("key", key);
    if (error) throw error;
  } else {
    const value = { items } as unknown as Record<string, unknown>;
    const { error } = await db
      .from("site_settings")
      .upsert({ key, value: value as never }, { onConflict: "key" });
    if (error) throw error;
  }
  await qc.invalidateQueries({ queryKey: ["site-lists"] });
}

export function useSaveList() {
  const qc = useQueryClient();
  return async <T,>(id: string, items: T[]) => {
    const before = (qc.getQueryData(["site-lists"]) as Record<string, unknown[]> | undefined)?.[id];
    const previous = Array.isArray(before) ? [...before] : null;
    await writeList(qc, id, items);
    recordHistory({
      label: `List “${id}”`,
      undo: () => writeList(qc, id, previous),
      redo: () => writeList(qc, id, items),
    });
  };
}

