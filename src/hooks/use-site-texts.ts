import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

const TEXT_PREFIX = "text.";

type SettingRow = { key: string; value: unknown };

async function fetchTexts(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", `${TEXT_PREFIX}%`);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as SettingRow[]) {
    const id = row.key.slice(TEXT_PREFIX.length);
    const v = row.value;
    if (typeof v === "string") map[id] = v;
    else if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) {
      const t = (v as Record<string, unknown>).text;
      if (typeof t === "string") map[id] = t;
    }
  }
  return map;
}

export function useSiteTexts() {
  return useQuery({
    queryKey: ["site-texts"],
    queryFn: fetchTexts,
    staleTime: 60_000,
  });
}

export function useText(id: string, fallback: string): string {
  const { data } = useSiteTexts();
  return data?.[id] ?? fallback;
}

export function useSaveText() {
  const qc = useQueryClient();
  return async (id: string, text: string) => {
    const key = `${TEXT_PREFIX}${id}`;
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: { text } }, { onConflict: "key" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["site-texts"] });
  };
}
