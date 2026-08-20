import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isRepurposeSourceMode } from "@/lib/content/repurpose";
import { ingestSourceFile, RepurposeSourceError, MAX_FILE_BYTES } from "@/lib/content/repurpose-source";
import { ingestSourceUrl, RepurposeUrlError } from "@/lib/content/repurpose-url";
import {
  REPURPOSE_ENCRYPTION_VERSION,
  encryptRepurposeSourceText,
} from "@/lib/content/repurpose-crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PASTE_CHARS = 120_000;
const MIN_PASTE_NON_WS = 50;
const MAX_DRAFT_TITLE = 120;
const MAX_DRAFT_BODY = 50_000;
const MAX_SOURCE_NAME = 500;
const MAX_SOURCE_URL = 2_048;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Source attribution helpers
// ---------------------------------------------------------------------------

function sourceAttribution(
  kind: string,
  name: string,
  url?: string | null,
): string {
  if (url) return url;
  return name;
}

// ---------------------------------------------------------------------------
// POST /api/content/repurpose/sources
// Accept multipart FormData with: websiteId, sourceMode, file | url | text
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in again to upload a source." },
      { status: 401 },
    );
  }

  // 2. Parse multipart form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }

  const websiteId = formData.get("websiteId");
  const sourceMode = formData.get("sourceMode");

  if (!isUUID(websiteId)) {
    return NextResponse.json(
      { error: "websiteId must be a valid UUID." },
      { status: 400 },
    );
  }
  if (!isRepurposeSourceMode(sourceMode)) {
    return NextResponse.json(
      { error: "sourceMode must be file, url, or paste." },
      { status: 400 },
    );
  }

  // 3. Verify website access via RLS
  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id, organization_id")
    .eq("id", websiteId)
    .maybeSingle();

  if (websiteError || !website) {
    return NextResponse.json(
      { error: "Website not found or not accessible to this account." },
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

  // 4. Ingest source based on mode
  let extractedText: string;
  let sourceName: string;
  let sourceUrl: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes = 0;
  let sourceKind: "file" | "paste" | "url" | "youtube";
  if (sourceMode === "file") {
    const file = formData.get("file");
    if (!file || typeof (file as { size?: unknown }).size !== "number") {
      return NextResponse.json(
        { error: "A file must be provided for file mode." },
        { status: 400 },
      );
    }
    const fileObj = file as File;

    // Pre-check size before reading arrayBuffer
    if (fileObj.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `The file is ${(fileObj.size / 1024 / 1024).toFixed(1)} MB, which exceeds the 20 MB limit. Compress or trim the file and try again.`,
          code: "OVERSIZED",
        },
        { status: 413 },
      );
    }

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await fileObj.arrayBuffer());
    } catch {
      return NextResponse.json(
        { error: "Could not read the file." },
        { status: 422 },
      );
    }

    let result;
    try {
      result = await ingestSourceFile(fileObj.name, fileObj.type, bytes);
    } catch (err) {
      if (err instanceof RepurposeSourceError) {
        const status =
          err.code === "OVERSIZED" ? 413 : err.code === "UNSUPPORTED" ? 400 : 422;
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status },
        );
      }
      return NextResponse.json(
        { error: "Could not process the file." },
        { status: 422 },
      );
    }

    extractedText = result.text;
    sourceName = fileObj.name.slice(0, MAX_SOURCE_NAME);
    mimeType = result.mimeType;
    sizeBytes = result.sizeBytes;
    sourceKind = "file";
  } else if (sourceMode === "url") {
    const rawUrl = formData.get("url");
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json(
        { error: "A url must be provided for url mode." },
        { status: 400 },
      );
    }
    if (rawUrl.trim().length > MAX_SOURCE_URL) {
      return NextResponse.json(
        { error: "The URL is too long. Use a public URL under 2,048 characters.", code: "INVALID_URL" },
        { status: 400 },
      );
    }

    let result;
    try {
      result = await ingestSourceUrl(rawUrl.trim());
    } catch (err) {
      if (err instanceof RepurposeUrlError) {
        const status =
          err.code === "RESPONSE_TOO_LARGE"
            ? 413
            : err.code === "INVALID_URL" ||
              err.code === "UNSUPPORTED_SCHEME" ||
              err.code === "PRIVATE_HOST"
            ? 400
            : 422;
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status },
        );
      }
      return NextResponse.json(
        { error: "Could not fetch the URL." },
        { status: 422 },
      );
    }

    extractedText = result.text;
    sourceName = (result.title || rawUrl.trim()).slice(0, MAX_SOURCE_NAME);
    sourceUrl = result.url;
    sourceKind = result.source === "youtube" ? "youtube" : "url";
  } else {
    // paste
    const pasteText = formData.get("text");
    if (typeof pasteText !== "string") {
      return NextResponse.json(
        { error: "text must be provided for paste mode." },
        { status: 400 },
      );
    }

    const trimmed = pasteText.trim();
    const nonWsCount = trimmed.replace(/\s/g, "").length;
    if (nonWsCount < MIN_PASTE_NON_WS) {
      return NextResponse.json(
        {
          error: `Pasted text must contain at least ${MIN_PASTE_NON_WS} non-whitespace characters.`,
          code: "NO_TEXT",
        },
        { status: 422 },
      );
    }

    extractedText = trimmed.slice(0, MAX_PASTE_CHARS);
    sourceName = "Pasted text";
    sourceKind = "paste";
  }

  // 5. Encrypt extracted plaintext before persistence. Raw bytes and plaintext
  // never enter a browser-selectable database column.
  const encryptedText = encryptRepurposeSourceText(extractedText, encryptionSecret);
  const database = supabase as unknown as SupabaseClient;
  const { data: inserted, error: insertError } = await database
    .from("repurpose_sources")
    .insert({
      organization_id: website.organization_id,
      website_id: websiteId,
      user_id: userId,
      source_kind: sourceKind,
      source_name: sourceName,
      source_url: sourceUrl ?? null,
      mime_type: mimeType ?? null,
      source_size_bytes: sizeBytes,
      extracted_text_ciphertext: encryptedText,
      extracted_characters: extractedText.length,
      encryption_version: REPURPOSE_ENCRYPTION_VERSION,
      status: "ready",
    })
    .select(
      "id, source_kind, source_name, source_url, mime_type, source_size_bytes, extracted_characters, status",
    )
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Could not save the source. Please try again." },
      { status: 500 },
    );
  }

  // 6. Return metadata — never include extracted_text
  return NextResponse.json({
    source: {
      id: inserted.id,
      kind: inserted.source_kind,
      name: inserted.source_name,
      url: inserted.source_url ?? null,
      mimeType: inserted.mime_type ?? null,
      sizeBytes: inserted.source_size_bytes,
      extractedCharacters: inserted.extracted_characters,
      status: inserted.status,
      attribution: sourceAttribution(sourceKind, sourceName, sourceUrl),
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/content/repurpose/sources
// Update editable draft fields (title, bodyMarkdown) for a source row
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  // 1. Authenticate
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string"
      ? claimsData.claims.sub
      : null;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in again to save the draft." },
      { status: 401 },
    );
  }

  // 2. Parse JSON body
  let body: {
    websiteId?: unknown;
    sourceId?: unknown;
    title?: unknown;
    bodyMarkdown?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { websiteId, sourceId, title, bodyMarkdown } = body;

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

  if (typeof title !== "string" || typeof bodyMarkdown !== "string") {
    return NextResponse.json(
      { error: "title and bodyMarkdown must both be strings." },
      { status: 400 },
    );
  }
  const titleStr = title.trim();
  const bodyStr = bodyMarkdown.trim();
  if (!titleStr || !bodyStr) {
    return NextResponse.json(
      { error: "The draft title and body cannot be empty." },
      { status: 400 },
    );
  }
  if (titleStr.length > MAX_DRAFT_TITLE || bodyStr.length > MAX_DRAFT_BODY) {
    return NextResponse.json(
      {
        error: `Drafts are limited to ${MAX_DRAFT_TITLE} title characters and ${MAX_DRAFT_BODY.toLocaleString()} body characters.`,
      },
      { status: 400 },
    );
  }

  // 3. Verify website access
  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id, organization_id")
    .eq("id", websiteId)
    .maybeSingle();

  if (websiteError || !website) {
    return NextResponse.json(
      { error: "Website not found or not accessible to this account." },
      { status: 404 },
    );
  }

  // 4. Verify source belongs to the requested website (via RLS + explicit filter)
  const database = supabase as unknown as SupabaseClient;
  const { data: existing, error: fetchError } = await database
    .from("repurpose_sources")
    .select("id, website_id, organization_id")
    .eq("id", sourceId)
    .eq("website_id", websiteId)
    .maybeSingle();

  if (fetchError || !existing) {
    // Explicitly deny cross-tenant/site access
    return NextResponse.json(
      {
        error:
          "Source not found or does not belong to the requested website.",
      },
      { status: 404 },
    );
  }

  // Additional cross-tenant guard
  if (existing.organization_id !== website.organization_id) {
    return NextResponse.json(
      { error: "Source does not belong to the requested website." },
      { status: 404 },
    );
  }

  // 5. Update only editable draft fields
  const { data: updated, error: updateError } = await database
    .from("repurpose_sources")
    .update({
      draft_title: titleStr,
      draft_body: bodyStr,
    })
    .eq("id", sourceId)
    .eq("website_id", websiteId)
    .select(
      "id, source_kind, source_name, source_url, mime_type, source_size_bytes, extracted_characters, status, output_type, target_keyword, draft_title, draft_body, draft_metadata",
    )
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Could not save the draft." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    source: {
      id: updated.id,
      kind: updated.source_kind,
      name: updated.source_name,
      url: updated.source_url ?? null,
      mimeType: updated.mime_type ?? null,
      sizeBytes: updated.source_size_bytes,
      extractedCharacters: updated.extracted_characters,
      status: updated.status,
      outputType: updated.output_type ?? null,
      targetKeyword: updated.target_keyword ?? null,
      draftTitle: updated.draft_title ?? null,
      draftBody: updated.draft_body ?? null,
      draftMetadata: updated.draft_metadata ?? null,
    },
  });
}
