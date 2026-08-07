import { NextResponse } from "next/server";
import {
  ARTICLE_FORMAT_OPTIONS,
  ARTICLE_VOICE_OPTIONS,
  DEFAULT_ARTICLE_PREFERENCES,
  DEFAULT_COPY_MODEL,
  READING_EASE_OPTIONS,
  buildAnthropicArticleRequest,
  buildArticleGenerationPrompt,
  parseGeneratedArticlePayload,
  validateGeneratedArticle,
  type ArticleFormat,
  type ArticleGenerationInput,
  type ArticleGenerationPreferences,
  type ArticleInternalPage,
  type ArticleVoice,
  type ReadingEase,
} from "@/lib/content/article-generation";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
const ARTICLE_GENERATION_TIMEOUT_MS = 240_000;
const ARTICLE_GENERATION_KEEPALIVE_MS = 5_000;
const ARTICLE_GENERATION_KEEPALIVE_CHUNK = " ".repeat(2048);

type GenerateRequest = {
  keyword?: unknown;
  businessName?: unknown;
  problemSolved?: unknown;
  idealCustomer?: unknown;
  differentiation?: unknown;
  internalPages?: unknown;
  preferences?: unknown;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function allowedValue<T extends string>(value: unknown, allowed: readonly { value: T }[], fallback: T) {
  return typeof value === "string" && allowed.some((option) => option.value === value) ? value as T : fallback;
}

function preferences(value: unknown): ArticleGenerationPreferences {
  const supplied = record(value);
  return {
    voice: allowedValue<ArticleVoice>(supplied.voice, ARTICLE_VOICE_OPTIONS, DEFAULT_ARTICLE_PREFERENCES.voice),
    format: allowedValue<ArticleFormat>(supplied.format, ARTICLE_FORMAT_OPTIONS, DEFAULT_ARTICLE_PREFERENCES.format),
    readingEase: allowedValue<ReadingEase>(supplied.readingEase, READING_EASE_OPTIONS, DEFAULT_ARTICLE_PREFERENCES.readingEase),
    specialInstructions: text(supplied.specialInstructions, 2000),
    addInfographics: typeof supplied.addInfographics === "boolean" ? supplied.addInfographics : DEFAULT_ARTICLE_PREFERENCES.addInfographics,
  };
}

function internalPages(value: unknown): ArticleInternalPage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item) => {
    const page = record(item);
    const title = text(page.title, 180);
    const url = text(page.url, 2048);
    if (!title || !/^https:\/\//i.test(url)) return [];
    return [{ title, url, text: text(page.text, 4000) }];
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to generate an article." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as GenerateRequest;
  const input: ArticleGenerationInput = {
    keyword: text(body.keyword, 300),
    businessName: text(body.businessName, 200),
    problemSolved: text(body.problemSolved, 4000),
    idealCustomer: text(body.idealCustomer, 4000),
    differentiation: text(body.differentiation, 4000),
    internalPages: internalPages(body.internalPages),
    preferences: preferences(body.preferences),
  };
  if (!input.keyword || !input.businessName) {
    return NextResponse.json({ error: "Choose a focus keyword and business before generating an article." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Article generation is not configured yet. Add ANTHROPIC_API_KEY to the server environment; the key must never be placed in browser code.",
      code: "ANTHROPIC_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const model = process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL;
  const prompt = buildArticleGenerationPrompt(input);
  const generatePayload = async () => {
    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(buildAnthropicArticleRequest(prompt, model)),
        signal: AbortSignal.any([AbortSignal.timeout(ARTICLE_GENERATION_TIMEOUT_MS), request.signal]),
      });
    } catch (cause) {
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      return {
        error: timedOut
          ? "Article generation took longer than expected. Your starter outline is safe—try again when you are ready."
          : "The article service could not be reached. Your starter outline is safe—try again in a moment.",
        code: timedOut ? "ARTICLE_GENERATION_TIMEOUT" : "ARTICLE_GENERATION_UNAVAILABLE",
      };
    }

    const payload = await response.json().catch(() => ({})) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string }; stop_reason?: string };
    if (!response.ok) return { error: payload.error?.message || `Claude returned HTTP ${response.status}.`, code: "ANTHROPIC_ERROR" };

    try {
      const rawText = (payload.content ?? []).filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
      if (payload.stop_reason === "max_tokens") throw new Error("ARTICLE_RESPONSE_INCOMPLETE");
      const article = parseGeneratedArticlePayload(rawText);
      const qualityIssues = await validateGeneratedArticle(article, input.keyword, input.preferences.format);
      return {
        draft: {
          keyword: input.keyword,
          title: article.title,
          metaDescription: article.metaDescriptions[0] ?? "",
          metaDescriptions: article.metaDescriptions,
          body: article.bodyMarkdown,
          sources: article.sources,
          infographics: article.infographics,
          bucketBrigades: article.bucketBrigades,
          preferences: input.preferences,
          generationStatus: "generated",
          generatedBy: model,
          qualityIssues,
          optimization: qualityIssues.length
            ? qualityIssues.map((issue) => ({ label: issue.code.replaceAll("_", " "), detail: issue.message }))
            : [
              { label: "Long-form SEO", detail: "The draft passed Destiny's word-count and heading-structure checks." },
              { label: "Writing rhythm", detail: "Contextual transitions and stock-phrase checks passed." },
              { label: "Human review", detail: "Review the article, sources, graphics, and business claims before publishing." },
            ],
        },
        quality: { passed: qualityIssues.length === 0, issues: qualityIssues },
        model,
      };
    } catch (cause) {
      console.error("article_generation_parse", { error: cause instanceof Error ? cause.message : "unknown" });
      return {
        error: "Claude returned an incomplete article draft. Your starter outline is safe—try again.",
        code: "ARTICLE_RESPONSE_INCOMPLETE",
      };
    }
  };

  const encoder = new TextEncoder();
  let cancelled = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(ARTICLE_GENERATION_KEEPALIVE_CHUNK));
      keepalive = setInterval(() => {
        if (!cancelled) controller.enqueue(encoder.encode(ARTICLE_GENERATION_KEEPALIVE_CHUNK));
      }, ARTICLE_GENERATION_KEEPALIVE_MS);
      void generatePayload().then((payload) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(payload)));
      }).catch((cause) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify({ error: cause instanceof Error ? cause.message : "Destiny could not generate this article." })));
      }).finally(() => {
        if (keepalive) clearInterval(keepalive);
        if (!cancelled) controller.close();
      });
    },
    cancel() {
      cancelled = true;
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/json; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
