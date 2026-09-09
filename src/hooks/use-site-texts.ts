import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";
import { recordHistory } from "@/hooks/use-edit-history";

const TEXT_PREFIX = "text.";

type SettingRow = { key: string; value: unknown };

async function fetchTexts(): Promise<Record<string, string>> {
  const { data, error } = await db
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

async function writeText(qc: ReturnType<typeof useQueryClient>, id: string, text: string | null) {
  const key = `${TEXT_PREFIX}${id}`;
  if (text === null) {
    // No stored value before this change — remove the row so the code default
    // takes over again.
    const { error } = await db.from("site_settings").delete().eq("key", key);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("site_settings")
      .upsert({ key, value: { text } }, { onConflict: "key" });
    if (error) throw error;
  }
  await qc.invalidateQueries({ queryKey: ["site-texts"] });
}

export function useSaveText() {
  const qc = useQueryClient();
  return async (id: string, text: string) => {
    const before = (qc.getQueryData(["site-texts"]) as Record<string, string> | undefined)?.[id];
    const previous = typeof before === "string" ? before : null;
    await writeText(qc, id, text);
    recordHistory({
      label: `Text “${id}”`,
      undo: () => writeText(qc, id, previous),
      redo: () => writeText(qc, id, text),
    });
  };
}

