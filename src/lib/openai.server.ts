/**
 * Direct OpenAI client for Point Studio.
 * Server-only. Reads OPENAI_API_KEY and OPENAI_MODEL from env.
 * No Supabase / Lovable AI dependency.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

export type OpenAIChatOptions = {
  messages: ChatMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

function readEnv(name: string): string | undefined {
  // Cloudflare Worker binding first, then process.env.
  const g = globalThis as unknown as { __POINTSTUDIO_WORKER_ENV__?: Record<string, unknown> };
  const fromWorker = g.__POINTSTUDIO_WORKER_ENV__?.[name];
  if (typeof fromWorker === "string" && fromWorker) return fromWorker;
  const fromProc = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return fromProc || undefined;
}

export function getOpenAIConfig(): { apiKey: string; model: string } {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add it in Project Settings → Secrets.",
    );
  }
  const model = readEnv("OPENAI_MODEL") || "gpt-4o-mini";
  return { apiKey, model };
}

export async function openaiChat(opts: OpenAIChatOptions): Promise<string> {
  const { apiKey, model: defaultModel } = getOpenAIConfig();
  const model = opts.model || defaultModel;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error("OpenAI: invalid API key.");
    if (res.status === 429) throw new Error("OpenAI rate limit — try again in a moment.");
    if (res.status === 402 || res.status === 403) {
      throw new Error("OpenAI: billing / quota error. Check your OpenAI account.");
    }
    throw new Error(`OpenAI error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Parse a JSON object out of an OpenAI response, tolerant of stray prose. */
export function parseJsonLoose<T = Record<string, unknown>>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through */ }
    }
    return {} as T;
  }
}
