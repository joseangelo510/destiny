import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isRepurposeOutput,
  buildRepurposePrompt,
  buildRepurposeAnthropicRequest,
  parseRepurposeResponse,
  type RepurposeOutput,
} from "@/lib/content/repurpose";
import { DEFAULT_COPY_MODEL } from "@/lib/content/article-generation";
import {
  RepurposeCryptoError,
  decryptRepurposeSourceText,
} from "@/lib/content/repurpose-crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERATE_TIMEOUT_MS = 170_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

type AnthropicContent = { type?: string; text?: string };
type AnthropicPayload = {
  content?: AnthropicContent[];
  error?: { message?: string };
  stop_reason?: string;
};

function anthropicText(payload: AnthropicPayload): string {
  return (payload.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

// ---------------------------------------------------------------------------
// POST /api/content/repurpose/generate
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = await createClient();
  const database = supabase as unknown as SupabaseClient;
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in again to generate a draft." },
      { status: 401 },
    );
  }

  // 2. Parse JSON body
  let body: {
    websiteId?: unknown;
    sourceId?: unknown;
    output?: unknown;
    targetKeyword?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { websiteId, sourceId, output, targetKeyword } = body;

  // 3. Validate IDs and output
  if (!isUUID(websiteId)) {
    return NextResponse.json(
      { error: "websiteId must be a valid UUID." },
      { status: 400 },
    );
  }
  if (!isUUID(sourceId)) {
    return NextResponse.json(
      { error: "sourceId must be a valid UUID." },
      { status: 400 },
    );
  }
  if (!isRepurposeOutput(output)) {
    return NextResponse.json(
      {
        error:
          "output must be one of: seo_blog_article, linkedin_post, x_thread, email, faq, outline.",
        code: "INVALID_OUTPUT",
      },
      { status: 400 },
    );
  }
  const repurposeOutput = output as RepurposeOutput;

  const keywordStr =
    typeof targetKeyword === "string" && targetKeyword.trim()
      ? targetKeyword.trim()
      : null;
  if (keywordStr && keywordStr.length > 300) {
    return NextResponse.json(
      { error: "targetKeyword must be 300 characters or fewer.", code: "INVALID_KEYWORD" },
      { status: 400 },
    );
  }

  // 4. Load accessible website for business context (RLS enforced)
  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select(
      "id, organization_id, business_name, products_services, ideal_customer, differentiation",
    )
    .eq("id", websiteId)
    .maybeSingle();

  if (websiteError || !website) {
    return NextResponse.json(
      { error: "Website not found or not accessible to this account." },
      { status: 404 },
    );
  }

  // 5. Validate optional keyword against approved keyword_preferences
  if (keywordStr) {
    const { data: kwRow, error: kwError } = await supabase
      .from("keyword_preferences")
      .select("keyword")
      .eq("website_id", websiteId)
      .eq("keyword", keywordStr)
      .eq("decision", "approved")
      .maybeSingle();

    if (kwError || !kwRow) {
      return NextResponse.json(
        {
          error: `"${keywordStr}" is not an approved keyword for this website. Choose a keyword from your approved list or leave the field empty.`,
          code: "UNAPPROVED_KEYWORD",
        },
        { status: 400 },
      );
    }
  }

  // 6. Load the source by BOTH id and website_id (RLS + explicit filter)
  const { data: source, error: sourceError } = await database
    .from("repurpose_sources")
    .select(
      "id, website_id, organization_id, source_name, source_url, source_kind, extracted_text_ciphertext, encryption_version, generation_attempts, status",
    )
    .eq("id", sourceId)
    .eq("website_id", websiteId)
    .maybeSingle();

  if (sourceError || !source) {
    return NextResponse.json(
      {
        error:
          "Source not found or does not belong to the requested website.",
        code: "SOURCE_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  // Cross-tenant guard
  if (source.organization_id !== website.organization_id) {
    return NextResponse.json(
      { error: "Source does not belong to the requested website." },
      { status: 404 },
    );
  }
  const encryptionSecret = process.env.SESSION_SECRET?.trim();
  if (!encryptionSecret) {
    return NextResponse.json(
      {
        error: "Secure source storage is not configured for this workspace.",
        code: "SOURCE_ENCRYPTION_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }
  let sourceText: string;
  try {
    sourceText = decryptRepurposeSourceText(
      source.extracted_text_ciphertext,
      encryptionSecret,
      source.encryption_version,
    );
  } catch (error) {
    const errorMessage = error instanceof RepurposeCryptoError
      ? "The saved source could not be opened securely. Upload the source again."
      : "The saved source could not be opened. Upload the source again.";
    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: "SOURCE_DECRYPTION_FAILED",
        last_error_message: errorMessage,
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);
    return NextResponse.json(
      { error: errorMessage, code: "SOURCE_DECRYPTION_FAILED" },
      { status: 500 },
    );
  }

  // 7. Check provider config before updating status
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Repurpose generation is not configured yet. Add ANTHROPIC_API_KEY to the server environment.",
        code: "ANTHROPIC_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }
  const model =
    process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL;

  // 8. Mark as writing and increment attempts before provider call
  const newAttempts = (source.generation_attempts ?? 0) + 1;
  const { error: markError } = await database
    .from("repurpose_sources")
    .update({
      status: "writing",
      generation_attempts: newAttempts,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", sourceId)
    .eq("website_id", websiteId);

  if (markError) {
    return NextResponse.json(
      { error: "Could not update source status. Please try again." },
      { status: 500 },
    );
  }

  // 9. Build business context string
  const businessContext = [
    website.business_name,
    website.products_services,
    website.ideal_customer,
    website.differentiation,
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 500);

  // 10. Build prompt using only server-decrypted persisted source text.
  const prompt = buildRepurposePrompt({
    source: {
      text: sourceText,
      attribution: source.source_url ?? source.source_name,
    },
    businessContext,
    targetKeyword: keywordStr ?? undefined,
    output: repurposeOutput,
  });

  const anthropicRequest = buildRepurposeAnthropicRequest(prompt, model);

  // 11. Call Anthropic with timeout + request.signal
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicRequest),
      signal: AbortSignal.any([
        AbortSignal.timeout(GENERATE_TIMEOUT_MS),
        request.signal,
      ]),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    const errorCode = isTimeout ? "GENERATION_TIMEOUT" : "PROVIDER_UNAVAILABLE";
    const errorMessage = isTimeout
      ? "Repurpose generation timed out. The source text is saved—try again when ready."
      : "The generation service could not be reached. The source text is saved—try again in a moment.";

    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage,
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);

    return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 503 });
  }

  // 12. Parse provider response
  let anthropicPayload: AnthropicPayload;
  try {
    anthropicPayload = await response.json();
  } catch {
    const errorCode = "PARSE_ERROR";
    const errorMessage = "Provider returned an unreadable response. The source text is saved—try again.";
    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage,
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);
    return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 502 });
  }

  if (!response.ok) {
    const errorCode = "ANTHROPIC_ERROR";
    const errorMessage =
      anthropicPayload.error?.message ??
      `Provider returned HTTP ${response.status}. The source text is saved—try again.`;
    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage.slice(0, 500),
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);
    return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 502 });
  }
  if (anthropicPayload.stop_reason === "max_tokens" || anthropicPayload.stop_reason === "refusal") {
    const errorCode = anthropicPayload.stop_reason === "max_tokens"
      ? "INCOMPLETE_OUTPUT"
      : "PROVIDER_REFUSAL";
    const errorMessage = anthropicPayload.stop_reason === "max_tokens"
      ? "The provider stopped before the draft was complete. The source text is saved—retry generation."
      : "The provider could not generate this draft. The source text is saved—review the source and retry.";
    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage,
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);
    return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 502 });
  }

  const rawText = anthropicText(anthropicPayload);
  const parseResult = parseRepurposeResponse(rawText, repurposeOutput);

  if (!parseResult.ok) {
    const errorCode = "PARSE_ERROR";
    const errorMessage = parseResult.error + " The source text is saved—try again.";
    await database
      .from("repurpose_sources")
      .update({
        status: "failed",
        last_error_code: errorCode,
        last_error_message: errorMessage.slice(0, 500),
      })
      .eq("id", sourceId)
      .eq("website_id", websiteId);
    return NextResponse.json({ error: errorMessage, code: errorCode }, { status: 502 });
  }

  const { draft } = parseResult;

  // 13. Persist success: output, keyword, title/body/excerpt + model metadata, status ready, clear errors
  const draftMetadata = {
    model,
    output: repurposeOutput,
    excerpt: draft.excerpt,
    generatedAt: new Date().toISOString(),
  };

  const { error: saveError } = await database
    .from("repurpose_sources")
    .update({
      status: "ready",
      output_type: repurposeOutput,
      target_keyword: keywordStr ?? null,
      draft_title: draft.title,
      draft_body: draft.bodyMarkdown,
      draft_metadata: draftMetadata,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", sourceId)
    .eq("website_id", websiteId);

  if (saveError) {
    return NextResponse.json(
      { error: "Draft was generated but could not be saved. Try again." },
      { status: 500 },
    );
  }

  // 14. Return result — never return extracted_text
  const attribution = source.source_url ?? source.source_name;

  return NextResponse.json({
    sourceId: source.id,
    draft,
    attribution,
    attempts: newAttempts,
  });
}
