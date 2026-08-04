import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AI_DAILY_LIMIT = 5;
const KEY = "ai.credits";

type CreditState = { date: string; used: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchCredits(): Promise<CreditState> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  const v = data?.value as Partial<CreditState> | null | undefined;
  if (!v || v.date !== today() || typeof v.used !== "number") {
    return { date: today(), used: 0 };
  }
  return { date: v.date, used: v.used };
}

/** Shared daily AI generation budget (5 per day). */
export function useAiCredits() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["ai-credits"], queryFn: fetchCredits, staleTime: 10_000 });
  const used = query.data?.used ?? 0;
  const remaining = Math.max(0, AI_DAILY_LIMIT - used);

  const consume = async () => {
    const current = await fetchCredits();
    if (current.used >= AI_DAILY_LIMIT) {
      qc.setQueryData(["ai-credits"], current);
      throw new Error(
        `Daily AI limit reached (${AI_DAILY_LIMIT} generations per day). Try again tomorrow.`,
      );
    }
    const next: CreditState = { date: current.date, used: current.used + 1 };
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: KEY, value: next }, { onConflict: "key" });
    if (error) throw error;
    qc.setQueryData(["ai-credits"], next);
  };

  return { used, remaining, limit: AI_DAILY_LIMIT, loading: query.isLoading, consume };
}
