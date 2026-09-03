import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db as supabase } from "@/lib/cms-client";

const LIST_PREFIX = "list.";

export function useSiteList<T>(id: string, fallback: T[]) {
  const key = `${LIST_PREFIX}${id}`;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["site-list", id],
    queryFn: async (): Promise<T[] | null> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const v = data.value as unknown;
      if (Array.isArray(v)) return v as T[];
      if (v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items)) {
        return (v as { items: T[] }).items;
      }
      return null;
    },
    staleTime: 60_000,
  });

  const items: T[] = query.data ?? fallback;

  const save = async (next: T[]) => {
    const value = { items: next } as unknown as never;
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["site-list", id] });
  };

  return { items, save, isPersisted: !!query.data };
}
