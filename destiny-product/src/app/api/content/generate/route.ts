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
      error: "Opus 4.8 article generation is not configured yet. Add ANTHROPIC_API_KEY to the server environment; the key must never be placed in browser code.",
      code: "ANTHROPIC_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const model = process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL;
  const prompt = buildArticleGenerationPrompt(input);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(buildAnthropicArticleRequest(prompt, model)),
  });

  const payload = await response.json().catch(() => ({})) as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
  if (!response.ok) {
    return NextResponse.json({ error: payload.error?.message || `Claude returned HTTP ${response.status}.` }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
  }

  try {
    const rawText = (payload.content ?? []).filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
    const article = parseGeneratedArticlePayload(rawText);
    const qualityIssues = await validateGeneratedArticle(article, input.keyword, input.preferences.format);
    return NextResponse.json({
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
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Claude returned an unreadable article draft." }, { status: 502 });
  }
}
