/**
 * Point Studio AI service.
 *
 * Server-only. Talks directly to OpenAI via OPENAI_API_KEY.
 * Model is configurable via env: OPENAI_MODEL (default gpt-4o-mini).
 * Any caller can override the model per-request with `opts.model`.
 *
 * ZERO Supabase dependency. Zero Lovable AI dependency.
 * Everything the site's AI features need (labels, alts, captions,
 * descriptions, tags, SEO copy, link metadata, video metadata,
 * generic site copy) lives here.
 */

// ---------- env ----------

declare global {
  // eslint-disable-next-line no-var
  var __POINTSTUDIO_WORKER_ENV__: Record<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var __env__: Record<string, unknown> | undefined;
}

type CloudflareRuntimeRequest = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

type AIEnvDebug = {
  runtime: string;
  hasProcessEnv: boolean;
  hasImportMetaEnv: boolean;
  hasProcessOpenAIKey: boolean;
  hasImportMetaOpenAIKey: boolean;
  hasWorkerGlobalOpenAIKey: boolean;
  hasNitroGlobalOpenAIKey: boolean;
  hasOpenAIKey: boolean;
  hasOpenAIModel: boolean;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getImportMetaEnv(): Record<string, string | undefined> | undefined {
  return (import.meta as ImportMetaWithEnv).env;
}

function detectRuntime(): string {
  if (globalThis.__POINTSTUDIO_WORKER_RUNTIME__) return globalThis.__POINTSTUDIO_WORKER_RUNTIME__;
  if (globalThis.__POINTSTUDIO_WORKER_ENV__ || globalThis.__env__) return "cloudflare";
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  return "unknown";
}

function resolveAIEnv(): { apiKey?: string; model: string; debug: AIEnvDebug } {
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const importMetaEnv = getImportMetaEnv();
  const workerEnv = globalThis.__POINTSTUDIO_WORKER_ENV__;
  const nitroEnv = globalThis.__env__;

  const apiKey =
    asNonEmptyString(processEnv?.OPENAI_API_KEY) ??
    asNonEmptyString(workerEnv?.OPENAI_API_KEY) ??
    asNonEmptyString(nitroEnv?.OPENAI_API_KEY) ??
    asNonEmptyString(importMetaEnv?.OPENAI_API_KEY);
  const model =
    asNonEmptyString(processEnv?.OPENAI_MODEL) ??
    asNonEmptyString(workerEnv?.OPENAI_MODEL) ??
    asNonEmptyString(nitroEnv?.OPENAI_MODEL) ??
    asNonEmptyString(importMetaEnv?.OPENAI_MODEL) ??
    "gpt-4o-mini";

  return {
    apiKey,
    model,
    debug: {
      runtime: detectRuntime(),
      hasProcessEnv: Boolean(processEnv),
      hasImportMetaEnv: Boolean(importMetaEnv),
      hasProcessOpenAIKey: Boolean(processEnv?.OPENAI_API_KEY),
      hasImportMetaOpenAIKey: Boolean(importMetaEnv?.OPENAI_API_KEY),
      hasWorkerGlobalOpenAIKey: Boolean(workerEnv?.OPENAI_API_KEY),
      hasNitroGlobalOpenAIKey: Boolean(nitroEnv?.OPENAI_API_KEY),
      hasOpenAIKey: Boolean(apiKey),
      hasOpenAIModel: Boolean(model),
    },
  };
}

export function getAIEnvDebug(): AIEnvDebug {
  return resolveAIEnv().debug;
}

export async function getAIConfig(): Promise<{ apiKey: string; model: string }> {
  const { apiKey, model, debug } = resolveAIEnv();
  console.log("AI env debug", debug);
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Add it in Project Settings → Secrets.",
    );
  }
  return { apiKey, model };
}

// ---------- low-level chat ----------

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export type ChatOptions = {
  messages: ChatMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  model?: string;
};

export async function aiChat(opts: ChatOptions): Promise<string> {
  const { apiKey, model: defaultModel } = await getAIConfig();
  const model = opts.model || defaultModel;

  const body: Record<string, unknown> = { model, messages: opts.messages };
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

/** Parse a JSON object out of a model response, tolerant of stray prose. */
export function parseJsonLoose<T = Record<string, unknown>>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        /* fall through */
      }
    }
    return {} as T;
  }
}

// ---------- brand / language helpers ----------

export type Lang = "en" | "ro";

function brandFor(lang: Lang) {
  return lang === "ro"
    ? "Point Studio — studio profesional foto & video din București (food, product, advertising, corporate, portret, editorial). Ton: încrezător, minimal, editorial, persoana I plural (noi)."
    : "Point Studio — a professional photo & video studio in Bucharest (food, product, advertising, corporate, portrait, editorial). Voice: confident, minimal, editorial, first-person plural.";
}
function langRuleFor(lang: Lang) {
  return lang === "ro"
    ? "SCRIE OBLIGATORIU ÎN LIMBA ROMÂNĂ, cu diacritice (ă â î ș ț). Nu folosi engleză."
    : "Write in English.";
}

// ---------- image metadata ----------

export type ImageMetadata = {
  label: string;
  alt: string;
  caption: string;
  description: string;
  tags: string[];
};

export async function generateImageMetadata(input: {
  imageUrl: string;
  context?: string;
  model?: string;
}): Promise<ImageMetadata> {
  const system =
    'You write metadata for a professional photography studio (Point Studio, Bucharest). Return STRICT JSON only with keys: {"label": string, "alt": string, "caption": string, "description": string, "tags": string[]}. label: 2-6 word title. alt: 8-16 word descriptive alt (no "image of" prefix). caption: 1 short sentence for display under the image. description: 2-3 sentences describing subject, mood, lighting, styling. tags: 4-8 lowercase single-word or short-phrase tags. No markdown.';
  const user = `Context: ${input.context ?? "portfolio asset"}. URL: ${input.imageUrl}. Write all metadata fields.`;
  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: input.imageUrl } },
        ],
      },
    ],
  });
  const parsed = parseJsonLoose<{
    label?: string;
    alt?: string;
    caption?: string;
    description?: string;
    tags?: unknown;
  }>(raw);
  return {
    label: (parsed.label ?? "").trim(),
    alt: (parsed.alt ?? "").trim(),
    caption: (parsed.caption ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

// ---------- video metadata ----------

export type VideoMetadata = {
  label: string;
  alt: string;
  caption: string;
  description: string;
  tags: string[];
};

export async function generateVideoMetadata(input: {
  videoUrl: string;
  context?: string;
  model?: string;
}): Promise<VideoMetadata> {
  const system =
    'You write metadata for video assets on a professional photo/video studio site (Point Studio, Bucharest). Return STRICT JSON only: {"label": string, "alt": string, "caption": string, "description": string, "tags": string[]}. label: 2-6 word title. alt: 8-16 word descriptive alt. caption: 1 short sentence. description: 2-3 sentences describing likely subject, mood, and production style based on the context. tags: 4-8 short lowercase tags. No markdown.';
  const user = `Video URL: ${input.videoUrl}. Context: ${input.context ?? "portfolio video"}.`;
  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose<{
    label?: string;
    alt?: string;
    caption?: string;
    description?: string;
    tags?: unknown;
  }>(raw);
  return {
    label: (parsed.label ?? "").trim(),
    alt: (parsed.alt ?? "").trim(),
    caption: (parsed.caption ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

// ---------- alt text (image-grounded) ----------

export async function generateAltText(input: {
  imageUrl: string;
  context?: string;
  model?: string;
}): Promise<{ alt: string }> {
  const system =
    'You write descriptive, SEO-friendly alt text for photography portfolio images. Return STRICT JSON only: {"alt": string}. Alt text: 8-16 words, describes visible subject, mood, lighting; no "image of" prefix; include category or brand when clear.';
  const user = `Category / context: ${input.context ?? "photography"}. Image URL: ${input.imageUrl}.`;
  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: input.imageUrl } },
        ],
      },
    ],
  });
  const parsed = parseJsonLoose<{ alt?: string }>(raw);
  return { alt: (parsed.alt ?? "").trim() };
}

// ---------- SEO copy ----------

export type SeoMetadata = { title: string; description: string; keywords: string };

export async function generateSeoText(input: {
  path?: string;
  label?: string;
  extraKeywords?: string;
  model?: string;
}): Promise<SeoMetadata> {
  const system =
    'You write concise, high-converting SEO metadata for a professional photography studio (Point Studio, Bucharest). Return STRICT JSON only, no prose, no markdown, matching schema {"title":string,"description":string,"keywords":string}. Title <= 60 chars. Description 140-160 chars. Keywords: 8-14 comma-separated phrases, targeting Google and AI answer engines. Include locale (Bucharest / Romania) where natural.';
  const user = `Page: ${input.label ?? input.path ?? "Home"} (${input.path ?? "/"}).\nExtra keyword hints: ${input.extraKeywords ?? "best professional photography, food photography, product photography, advertising, corporate, portrait, editorial, commercial photographer Bucharest"}.\nWrite metadata for this page.`;
  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose<Partial<SeoMetadata>>(raw);
  return {
    title: (parsed.title ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    keywords: (parsed.keywords ?? "").trim(),
  };
}

// ---------- link metadata ----------

export type LinkMetadata = { title: string; description: string; category: string };

async function fetchPageHints(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 PointStudioBot/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    const html = (await r.text()).slice(0, 12000);
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
    const desc =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      "";
    return `Page title: ${title}\nPage description: ${desc}`.slice(0, 800);
  } catch {
    return "";
  }
}

export async function generateLinkMetadata(input: {
  url: string;
  context?: string;
  model?: string;
}): Promise<LinkMetadata> {
  const pageInfo = await fetchPageHints(input.url);
  const system =
    'You write link metadata for the Point Studio (Bucharest photo/video studio) website. Return STRICT JSON only: {"title": string, "description": string, "category": string}. title: 2-6 word display label. description: 1 short sentence. category: one of "social", "portfolio", "press", "shop", "resource", "other". No markdown.';
  const user = `URL: ${input.url}\nContext: ${input.context ?? "external link"}\n${pageInfo}`;
  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose<Partial<LinkMetadata>>(raw);
  return {
    title: (parsed.title ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    category: (parsed.category ?? "other").trim().toLowerCase(),
  };
}

// ---------- generic site copy ----------

export async function generateSiteCopy(input: {
  fieldId?: string;
  instruction?: string;
  current?: string;
  maxChars?: number;
  context?: string;
  language?: Lang;
  model?: string;
}): Promise<{ text: string }> {
  const lang: Lang = input.language ?? "en";
  const cap = input.maxChars ?? 240;
  const system = `You write website copy for ${brandFor(lang)}. ${langRuleFor(lang)} Return STRICT JSON only: {"text": string}. No markdown, no quotes. Keep under ${cap} characters. Match the tone of the field.`;
  const user = [
    input.fieldId ? `Field id: ${input.fieldId}` : "",
    input.context ? `Context: ${input.context}` : "",
    input.current ? `Current text: """${input.current}"""` : "",
    input.instruction
      ? `Instruction: ${input.instruction}`
      : lang === "ro"
        ? "Rescrie textul curent să fie mai clar, convingător și pe brand. Dacă nu există text curent, scrie o variantă potrivită pentru acest câmp."
        : "Rewrite the current text to be sharper, more compelling, and on-brand. If there is no current text, write a fitting piece of copy for this field.",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await aiChat({
    model: input.model,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const parsed = parseJsonLoose<{ text?: string }>(raw);
  return { text: (parsed.text ?? "").trim() };
}
