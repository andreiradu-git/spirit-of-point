import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/cms-client";

/**
 * AI usage counter.
 *
 * This is a plain counter kept for visibility only — there is no application
 * limit on AI generations. (Any provider-side rate limit still applies and is
 * surfaced as a normal error from the AI call.)
 */
const KEY = "ai.credits";

type CreditState = { date: string; used: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchCredits(): Promise<CreditState> {
  const { data, error } = await db
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

/** Daily AI usage counter. Never blocks a generation. */
export function useAiCredits() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["ai-credits"], queryFn: fetchCredits, staleTime: 10_000 });
  const used = query.data?.used ?? 0;

  const consume = async () => {
    try {
      const current = await fetchCredits();
      const next: CreditState = { date: current.date, used: current.used + 1 };
      await db.from("site_settings").upsert({ key: KEY, value: next }, { onConflict: "key" });
      qc.setQueryData(["ai-credits"], next);
    } catch (e) {
      // Counting is best-effort: it must never prevent an AI action.
      console.warn("AI usage counter unavailable", e);
    }
  };

  return { used, loading: query.isLoading, consume };
}
