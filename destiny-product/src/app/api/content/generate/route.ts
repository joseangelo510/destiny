import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ARTICLE_FORMAT_OPTIONS,
  ARTICLE_VOICE_OPTIONS,
  DEFAULT_ARTICLE_PREFERENCES,
  DEFAULT_COPY_MODEL,
  READING_EASE_OPTIONS,
  buildAnthropicArticleRequest,
  buildArticleEvidencePack,
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
import { encodeArticleGenerationEvent, type ArticleGenerationPhase } from "@/lib/content/generation-stream";
import {
  SEO_ARTICLE_RECOVERY_MAX_WORDS,
  SEO_ARTICLE_RECOVERY_MIN_WORDS,
  articleContinuationDecision,
  buildAnthropicArticleContinuationRequest,
  buildArticleContinuationPrompt,
  mergeArticleContinuation,
  parseArticleContinuation,
} from "@/lib/content/article-recovery";
import { normalizeInternalUrl } from "@/lib/seo/interlinking";
import { loadWebsiteVoiceContext } from "@/lib/interviews/server";

export const maxDuration = 300;
const ARTICLE_EVIDENCE_TIMEOUT_MS = 30_000;
const ARTICLE_WRITING_TIMEOUT_MS = 170_000;
const ARTICLE_CONTINUATION_TIMEOUT_MS = 70_000;
const ARTICLE_GENERATION_KEEPALIVE_MS = 5_000;

type GenerateRequest = {
  websiteId?: unknown;
  auditId?: unknown;
  keyword?: unknown;
  businessName?: unknown;
  problemSolved?: unknown;
  idealCustomer?: unknown;
  differentiation?: unknown;
  internalPages?: unknown;
  preferences?: unknown;
};

type AnthropicMessagePayload = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function anthropicText(payload: AnthropicMessagePayload) {
  return (payload.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

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

async function loadVerifiedInternalPages(supabase: Awaited<ReturnType<typeof createClient>>, websiteId: string, auditId: string) {
  const [{ data: website }, { data: audit }] = await Promise.all([
    supabase.from("websites").select("id,url").eq("id", websiteId).maybeSingle(),
    supabase.from("audits").select("id,website_id").eq("id", auditId).eq("website_id", websiteId).maybeSingle(),
  ]);
  if (!website || !audit) return null;
  const db = supabase as unknown as SupabaseClient;
  const { data: run } = await db.from("interlink_runs").select("manifest").eq("website_id", websiteId).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let candidates = Array.isArray(record(run?.manifest).pages) ? record(run?.manifest).pages as unknown[] : [];
  if (!candidates.length) {
    const { data: metrics } = await supabase.from("audit_metrics").select("raw_provider_payload").eq("audit_id", auditId).maybeSingle();
    const providerResult = record(record(metrics?.raw_provider_payload).providerResult);
    candidates = Array.isArray(providerResult.pages) ? providerResult.pages : [];
  }
  const seen = new Set<string>();
  return internalPages(candidates.map((candidate) => {
    const page = record(candidate);
    const url = typeof page.url === "string" ? normalizeInternalUrl(page.url, website.url) : null;
    if (!url || seen.has(url) || ("statusCode" in page && Number(page.statusCode) !== 200) || ("indexable" in page && page.indexable !== true)) return {};
    seen.add(url);
    return { title: typeof page.title === "string" ? page.title : url, url, text: typeof page.text === "string" ? page.text : "" };
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to generate an article." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as GenerateRequest;
  const websiteId = text(body.websiteId, 100);
  const auditId = text(body.auditId, 100);
  if (!websiteId || !auditId) return NextResponse.json({ error: "Choose a verified website and audit before generating an article." }, { status: 400 });
  const verifiedInternalPages = await loadVerifiedInternalPages(supabase, websiteId, auditId);
  if (!verifiedInternalPages) return NextResponse.json({ error: "The website or audit is not available in this workspace." }, { status: 404 });
  const input: ArticleGenerationInput = {
    keyword: text(body.keyword, 300),
    businessName: text(body.businessName, 200),
    problemSolved: text(body.problemSolved, 4000),
    idealCustomer: text(body.idealCustomer, 4000),
    differentiation: text(body.differentiation, 4000),
    internalPages: verifiedInternalPages,
    preferences: preferences(body.preferences),
  };
  if (!input.keyword || !input.businessName) {
    return NextResponse.json({ error: "Choose a focus keyword and business before generating an article." }, { status: 400 });
  }
  const voiceContext = await loadWebsiteVoiceContext(supabase as unknown as SupabaseClient, websiteId).catch(() => "");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Article generation is not configured yet. Add ANTHROPIC_API_KEY to the server environment; the key must never be placed in browser code.",
      code: "ANTHROPIC_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const model = process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL;
  const generatePayload = async (onPhase: (phase: ArticleGenerationPhase) => void) => {
    let researchData: unknown;
    let evidenceTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        supabase.functions.invoke("seo-research", { body: { kind: "article_evidence", keyword: input.keyword, locationName: "United States" } }),
        new Promise<never>((_, reject) => { evidenceTimeout = setTimeout(() => reject(new DOMException("Evidence timeout", "TimeoutError")), ARTICLE_EVIDENCE_TIMEOUT_MS); }),
      ]);
      if (result.error || !result.data) throw new Error(result.error?.message || "Destiny could not retrieve article evidence.");
      researchData = result.data;
    } catch (cause) {
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      return {
        error: timedOut
          ? "Article evidence search took longer than expected. Your brief and settings are saved—try again when you are ready."
          : "The evidence search could not be reached. Your brief and settings are saved—try again in a moment.",
        code: timedOut ? "ARTICLE_EVIDENCE_TIMEOUT" : "ARTICLE_EVIDENCE_UNAVAILABLE",
      };
    } finally {
      if (evidenceTimeout) clearTimeout(evidenceTimeout);
    }

    let researchEvidence = "";
    try { researchEvidence = buildArticleEvidencePack(record(researchData).rows); }
    catch (cause) { return { error: cause instanceof Error ? cause.message : "Destiny could not verify enough article sources yet.", code: "ARTICLE_EVIDENCE_INCOMPLETE" }; }

    const basePrompt = buildArticleGenerationPrompt(input, researchEvidence);
    const prompt = voiceContext ? `${basePrompt}\n\n${voiceContext}` : basePrompt;
    const writingDeadline = AbortSignal.timeout(ARTICLE_WRITING_TIMEOUT_MS);
    const writeArticle = (payload: unknown) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([writingDeadline, request.signal]),
    });

    onPhase("writing");
    let response: Response;
    try {
      response = await writeArticle(buildAnthropicArticleRequest(prompt, model));
    } catch (cause) {
      const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
      return {
        error: timedOut
          ? "Article writing took longer than expected. Your brief and settings are saved—try again when you are ready."
          : "The article service could not be reached. Your brief and settings are saved—try again in a moment.",
        code: timedOut ? "ARTICLE_WRITING_TIMEOUT" : "ARTICLE_GENERATION_UNAVAILABLE",
      };
    }

    const payload = await response.json().catch(() => ({})) as AnthropicMessagePayload;
    if (!response.ok) return { error: payload.error?.message || `Claude writing returned HTTP ${response.status}.`, code: "ANTHROPIC_ERROR" };

    try {
      if (payload.stop_reason === "refusal") throw new Error("ARTICLE_RESPONSE_REFUSED");
      let article = parseGeneratedArticlePayload(anthropicText(payload));
      const initialDecision = articleContinuationDecision(article.bodyMarkdown, input.preferences.format, payload.stop_reason);
      console.info("article_generation_initial", {
        model,
        stopReason: payload.stop_reason ?? "unknown",
        inputTokens: payload.usage?.input_tokens ?? null,
        outputTokens: payload.usage?.output_tokens ?? null,
        wordCount: initialDecision.wordCount,
        cleanEnding: initialDecision.cleanEnding,
        continuationReason: initialDecision.reason,
        finalCharacters: article.bodyMarkdown.slice(-160),
      });

      let recoveryIssue: { code: "incomplete_output"; message: string } | null = null;
      if (initialDecision.needed) {
        onPhase("finishing");
        try {
          const continuationPrompt = buildArticleContinuationPrompt({
            bodyMarkdown: article.bodyMarkdown,
            researchEvidence,
            // Buffered band: aiming at the bare 2,000-word policy floor left
            // finished drafts at 1,994–2,025 words, where counting variance
            // flips them to incomplete. The finishing pass now targets
            // 2,200–2,900 so the result clears both policy boundaries.
            targetMinimumWords: input.preferences.format === "seo_article" ? SEO_ARTICLE_RECOVERY_MIN_WORDS : Math.max(700, initialDecision.wordCount + 400),
            targetMaximumWords: input.preferences.format === "seo_article" ? SEO_ARTICLE_RECOVERY_MAX_WORDS : Math.max(1_200, initialDecision.wordCount + 1_000),
            // A cleanly ended but short article gets the expansion framing so
            // the model adds H3 coverage instead of declaring it complete.
            reason: initialDecision.reason,
          });
          const continuationResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(buildAnthropicArticleContinuationRequest(continuationPrompt, model)),
            signal: AbortSignal.any([AbortSignal.timeout(ARTICLE_CONTINUATION_TIMEOUT_MS), request.signal]),
          });
          const continuationPayload = await continuationResponse.json().catch(() => ({})) as AnthropicMessagePayload;
          if (!continuationResponse.ok) throw new Error(continuationPayload.error?.message || `Claude completion returned HTTP ${continuationResponse.status}.`);
          if (continuationPayload.stop_reason === "max_tokens" || continuationPayload.stop_reason === "refusal") {
            throw new Error(`Claude completion stopped with ${continuationPayload.stop_reason}.`);
          }

          article = {
            ...article,
            bodyMarkdown: mergeArticleContinuation(article.bodyMarkdown, parseArticleContinuation(anthropicText(continuationPayload))),
          };
          const completedDecision = articleContinuationDecision(article.bodyMarkdown, input.preferences.format, continuationPayload.stop_reason);
          console.info("article_generation_recovery", {
            model,
            attempted: true,
            stopReason: continuationPayload.stop_reason ?? "unknown",
            inputTokens: continuationPayload.usage?.input_tokens ?? null,
            outputTokens: continuationPayload.usage?.output_tokens ?? null,
            wordCount: completedDecision.wordCount,
            cleanEnding: completedDecision.cleanEnding,
            remainingReason: completedDecision.reason,
            finalCharacters: article.bodyMarkdown.slice(-160),
          });
          if (completedDecision.needed) {
            recoveryIssue = {
              code: "incomplete_output",
              message: "Destiny completed one bounded finishing pass, but the combined article still ended before it met the completion requirements. Generate again before approval.",
            };
          }
        } catch (cause) {
          console.error("article_generation_recovery", {
            model,
            attempted: true,
            error: cause instanceof Error ? cause.message : "unknown",
            preservedWordCount: initialDecision.wordCount,
            finalCharacters: article.bodyMarkdown.slice(-160),
          });
          recoveryIssue = {
            code: "incomplete_output",
            message: "The first article response ended early and Destiny's single finishing pass could not complete it. The partial draft is preserved, but it cannot be approved.",
          };
        }
      }

      const qualityIssues = await validateGeneratedArticle(article, input.keyword, input.preferences.format, input.internalPages);
      if (recoveryIssue && !qualityIssues.some((issue) => issue.code === "incomplete_output")) qualityIssues.unshift(recoveryIssue);
      return {
        draft: {
          keyword: input.keyword,
          title: article.title,
          metaTitle: article.metaTitle,
          titleCandidates: article.titleCandidates,
          metaDescription: article.metaDescriptions[0] ?? "",
          metaDescriptions: article.metaDescriptions,
          body: article.bodyMarkdown,
          sources: article.sources,
          infographics: article.infographics,
          bucketBrigades: article.bucketBrigades,
          preferences: input.preferences,
          // A draft whose bounded finishing pass failed must stay
          // non-approvable even after the client recomputes quality issues,
          // which has no incomplete-output check of its own.
          generationStatus: recoveryIssue ? "needs_generation" : "generated",
          generatedBy: model,
          verifiedInternalPages: input.internalPages,
          qualityIssues,
          optimization: qualityIssues.length
            ? qualityIssues.map((issue) => ({ label: issue.code.replaceAll("_", " "), detail: issue.message }))
            : [
              { label: "Long-form SEO", detail: "The draft passed Destiny's word-count and heading-structure checks." },
              { label: "Writing rhythm", detail: "Contextual transitions and stock-phrase checks passed." },
              { label: "Human review", detail: "Review the article, sources, graphics, and business claims before publishing." },
            ],
        },
        quality: { passed: qualityIssues.length === 0, issues: qualityIssues, recovered: initialDecision.needed && !recoveryIssue },
        model,
      };
    } catch (cause) {
      console.error("article_generation_parse", { error: cause instanceof Error ? cause.message : "unknown" });
      return {
        error: "Claude returned an incomplete article draft. Your brief and settings are saved—try again.",
        code: "ARTICLE_RESPONSE_INCOMPLETE",
      };
    }
  };

  const encoder = new TextEncoder();
  let cancelled = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (encoded: string) => {
        if (cancelled) return;
        try { controller.enqueue(encoder.encode(encoded)); } catch { cancelled = true; }
      };
      send(encodeArticleGenerationEvent({ type: "phase", phase: "researching" }));
      keepalive = setInterval(() => send(encodeArticleGenerationEvent({ type: "keepalive" })), ARTICLE_GENERATION_KEEPALIVE_MS);
      void generatePayload((phase) => send(encodeArticleGenerationEvent({ type: "phase", phase }))).then((payload) => {
        send(encodeArticleGenerationEvent({ type: "result", payload }));
      }).catch((cause) => {
        send(encodeArticleGenerationEvent({ type: "result", payload: { error: cause instanceof Error ? cause.message : "Destiny could not generate this article." } }));
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
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
