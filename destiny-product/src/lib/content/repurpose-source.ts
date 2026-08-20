/**
 * repurpose-source.ts
 *
 * Secure file-ingestion library for the Repurpose feature.
 * Supports text-layer PDF, DOCX, TXT, MD files only.
 * Hard 20 MB file cap; extracted text capped at 120 000 characters.
 * Never sends raw file bytes to any external service.
 */

import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_TEXT_CHARS = 120_000;
export const MAX_PDF_PAGES = 250;
/** Maximum total uncompressed size we allow across all DOCX ZIP entries. */
export const MAX_DOCX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024; // 40 MB
/** Maximum number of entries in a DOCX ZIP central directory. */
export const MAX_DOCX_ZIP_ENTRIES = 1000;
/** Maximum compression ratio per entry (compressed → uncompressed). */
export const MAX_DOCX_COMPRESSION_RATIO = 100;

// ─── Canonical MIME map ───────────────────────────────────────────────────────

const CANONICAL_MIME: Record<SupportedExtension, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

// ─── Error types ─────────────────────────────────────────────────────────────

export class RepurposeSourceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "OVERSIZED"
      | "UNSUPPORTED"
      | "MALFORMED"
      | "IMAGE_ONLY_PDF"
      | "UTF8_DECODE"
      | "NO_TEXT"
      | "TOO_COMPLEX",
  ) {
    super(message);
    this.name = "RepurposeSourceError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedExtension = "pdf" | "docx" | "txt" | "md";

export interface IngestionResult {
  /** Detected extension (lowercased) */
  extension: SupportedExtension;
  /** Canonical MIME type (never empty) */
  mimeType: string;
  /** Extracted plain text, capped at MAX_TEXT_CHARS */
  text: string;
  /** Original file size in bytes */
  sizeBytes: number;
}

// ─── Magic-byte signatures ────────────────────────────────────────────────────

const MAGIC: Record<SupportedExtension, readonly number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4b, 0x03, 0x04]], // PK (ZIP)
  txt: [], // no magic bytes – accept any
  md: [], // no magic bytes – accept any
};

const MIME_WHITELIST: Record<SupportedExtension, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip", // some browsers declare zip for docx
    "application/octet-stream", // fallback from strict validators
  ],
  txt: ["text/plain", "application/octet-stream"],
  md: ["text/markdown", "text/plain", "application/octet-stream"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getExtension(filename: string): SupportedExtension {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  const supported: SupportedExtension[] = ["pdf", "docx", "txt", "md"];
  if (supported.includes(ext as SupportedExtension)) {
    return ext as SupportedExtension;
  }
  throw new RepurposeSourceError(
    `File type ".${ext || "(none)"}" is not supported. Upload a PDF, DOCX, TXT, or Markdown file.`,
    "UNSUPPORTED",
  );
}

/**
 * Validates the declared MIME type.
 * An empty/absent MIME is allowed — the caller falls back to the canonical MIME
 * once extension + signature checks have already passed.
 * Returns the resolved canonical MIME string.
 */
function resolveMime(ext: SupportedExtension, declaredMime: string): string {
  const base = declaredMime.split(";")[0].trim().toLowerCase();
  if (base === "" || base === "application/octet-stream") {
    // Empty or generic MIME — trust extension + magic bytes (validated separately).
    // Return canonical MIME so callers always get a typed value.
    return CANONICAL_MIME[ext];
  }
  if (!MIME_WHITELIST[ext].includes(base)) {
    throw new RepurposeSourceError(
      `The declared content type "${base}" does not match the expected type for a .${ext} file.`,
      "UNSUPPORTED",
    );
  }
  return base;
}

function validateMagicBytes(ext: SupportedExtension, bytes: Uint8Array): void {
  const signatures = MAGIC[ext];
  if (signatures.length === 0) return; // txt/md – no magic check
  const matches = signatures.some((sig) =>
    sig.every((b, i) => bytes[i] === b),
  );
  if (!matches) {
    throw new RepurposeSourceError(
      `The file does not appear to be a valid .${ext} file (magic-byte mismatch).`,
      "MALFORMED",
    );
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    return decoder.decode(bytes);
  } catch {
    throw new RepurposeSourceError(
      "The file contains invalid UTF-8 sequences and cannot be read as text.",
      "UTF8_DECODE",
    );
  }
}

function capText(raw: string): string {
  if (raw.length <= MAX_TEXT_CHARS) return raw;
  return raw.slice(0, MAX_TEXT_CHARS);
}

function assertNotEmpty(text: string, label: string): void {
  if (!text.trim()) {
    throw new RepurposeSourceError(
      `The ${label} contains no extractable text. Add text content to the file, or paste the text directly.`,
      "NO_TEXT",
    );
  }
}

// ─── DOCX ZIP central-directory validation ────────────────────────────────────

interface ZipCentralEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  generalFlags: number;
  method: number;
}

/**
 * Parse the ZIP central directory from the raw DOCX bytes.
 * Validates:
 *   - Entry count ≤ MAX_DOCX_ZIP_ENTRIES
 *   - No encrypted entries (general-purpose bit 0 set)
 *   - Total uncompressed size ≤ MAX_DOCX_UNCOMPRESSED_BYTES
 *   - No entry has compression ratio > MAX_DOCX_COMPRESSION_RATIO
 *   - [Content_Types].xml and word/document.xml are present
 *
 * Throws RepurposeSourceError(MALFORMED) or (TOO_COMPLEX) on violations.
 */
function validateDocxZip(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.byteLength;

  // ── Locate End-of-Central-Directory record ────────────────────────────────
  // EOCD signature: 0x06054b50, minimum size 22 bytes.
  // Search backwards from end (comment can follow).
  let eocdOffset = -1;
  const maxSearch = Math.min(len - 22, 65535 + 22); // max comment length
  for (let i = len - 22; i >= len - 22 - maxSearch && i >= 0; i--) {
    if (
      view.getUint32(i, true) === 0x06054b50
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new RepurposeSourceError(
      "The DOCX file does not contain a valid ZIP end-of-central-directory record.",
      "MALFORMED",
    );
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries > MAX_DOCX_ZIP_ENTRIES) {
    throw new RepurposeSourceError(
      `The DOCX ZIP archive has ${totalEntries} entries, which exceeds the limit of ${MAX_DOCX_ZIP_ENTRIES}. The file may be corrupt or malicious.`,
      "TOO_COMPLEX",
    );
  }

  if (centralDirOffset + centralDirSize > len) {
    throw new RepurposeSourceError(
      "The DOCX ZIP central directory points outside the file bounds.",
      "MALFORMED",
    );
  }

  // ── Walk central directory ────────────────────────────────────────────────
  const dec = new TextDecoder("utf-8", { fatal: false });
  const entries: ZipCentralEntry[] = [];
  let pos = centralDirOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > len) {
      throw new RepurposeSourceError(
        "The DOCX ZIP central directory is truncated.",
        "MALFORMED",
      );
    }
    const sig = view.getUint32(pos, true);
    if (sig !== 0x02014b50) {
      throw new RepurposeSourceError(
        "The DOCX ZIP central directory contains an unexpected signature.",
        "MALFORMED",
      );
    }

    const generalFlags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);

    if (pos + 46 + nameLen > len) {
      throw new RepurposeSourceError(
        "The DOCX ZIP central directory entry name extends outside the file.",
        "MALFORMED",
      );
    }
    const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
    const name = dec.decode(nameBytes);

    entries.push({ name, compressedSize, uncompressedSize, generalFlags, method });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  // ── Validate entries ──────────────────────────────────────────────────────
  let totalUncompressed = 0;

  for (const entry of entries) {
    // Bit 0 of general-purpose flags = encryption
    if (entry.generalFlags & 0x01) {
      throw new RepurposeSourceError(
        `The DOCX file contains an encrypted entry "${entry.name}". Remove encryption and try again.`,
        "MALFORMED",
      );
    }

    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new RepurposeSourceError(
        `The DOCX file expands to more than ${MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024} MB uncompressed. Use a smaller document.`,
        "TOO_COMPLEX",
      );
    }

    // Bomb ratio check (skip stored method=0 and directories with size 0)
    if (entry.method !== 0 && entry.compressedSize > 0 && entry.uncompressedSize > 0) {
      const ratio = entry.uncompressedSize / entry.compressedSize;
      if (ratio > MAX_DOCX_COMPRESSION_RATIO) {
        throw new RepurposeSourceError(
          `The DOCX ZIP entry "${entry.name}" has a suspicious compression ratio (${ratio.toFixed(0)}:1). The file may be a zip bomb.`,
          "MALFORMED",
        );
      }
    }
  }

  // ── Require mandatory OOXML parts ─────────────────────────────────────────
  const names = new Set(entries.map((e) => e.name));
  if (!names.has("[Content_Types].xml")) {
    throw new RepurposeSourceError(
      'The DOCX file is missing the required "[Content_Types].xml" part.',
      "MALFORMED",
    );
  }
  if (!names.has("word/document.xml")) {
    throw new RepurposeSourceError(
      'The DOCX file is missing the required "word/document.xml" part.',
      "MALFORMED",
    );
  }
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Lazy-import so non-PDF paths don't pay the module cost.
  const { getDocument, GlobalWorkerOptions } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs" as string
  );

  // In Node/Vitest we must point workerSrc at the real worker file via a
  // file:// URL so pdfjs-dist can spawn it without browser APIs.
  if (!GlobalWorkerOptions.workerSrc) {
    const req = createRequire(import.meta.url);
    const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }

  let pdf: Awaited<ReturnType<typeof getDocument>["promise"]>;
  try {
    pdf = await getDocument({
      data: bytes,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
    }).promise;
  } catch (err: unknown) {
    throw new RepurposeSourceError(
      `The PDF could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
      "MALFORMED",
    );
  }

  // Page-count complexity cap
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new RepurposeSourceError(
      `The PDF has ${pdf.numPages} pages, which exceeds the ${MAX_PDF_PAGES}-page limit. Split the document and upload individual sections.`,
      "TOO_COMPLEX",
    );
  }

  let totalText = "";
  let totalItems = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str: string }>) {
      totalText += item.str + " ";
      totalItems++;
    }
    if (totalText.length > MAX_TEXT_CHARS) break;
  }

  const text = totalText.trim();

  // Image-only / scanned PDFs: no extractable text items at all
  if (pdf.numPages > 0 && totalItems === 0) {
    throw new RepurposeSourceError(
      "This PDF appears to be image-only or scanned. Re-upload a version with a selectable text layer, or paste the text directly.",
      "IMAGE_ONLY_PDF",
    );
  }

  return text;
}

// ─── DOCX extraction ──────────────────────────────────────────────────────────

async function extractDocx(bytes: Uint8Array): Promise<string> {
  // Validate ZIP central directory metadata first — no decompression yet.
  validateDocxZip(bytes);

  const mammoth = await import("mammoth");
  let result: { value: string; messages: unknown[] };
  try {
    result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  } catch (err: unknown) {
    throw new RepurposeSourceError(
      `The DOCX file could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
      "MALFORMED",
    );
  }
  return result.value.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest a file uploaded by the user.
 *
 * @param filename   Original filename (used for extension detection).
 * @param mimeType   Declared MIME type from the browser / multipart header.
 *                   May be empty — the canonical MIME is then derived from the extension.
 * @param bytes      Raw file bytes.
 */
export async function ingestSourceFile(
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<IngestionResult> {
  // 1. Size check
  if (bytes.length > MAX_FILE_BYTES) {
    throw new RepurposeSourceError(
      `The file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB, which exceeds the 20 MB limit. Compress or trim the file and try again.`,
      "OVERSIZED",
    );
  }

  // 2. Extension check
  const extension = getExtension(filename);

  // 3. MIME resolution (validates non-empty MIMEs, accepts empty with fallback to canonical)
  const resolvedMime = resolveMime(extension, mimeType);

  // 4. Magic-byte check (runs even when MIME was empty)
  validateMagicBytes(extension, bytes);

  // 5. Extract text
  let rawText: string;

  if (extension === "pdf") {
    rawText = await extractPdf(bytes);
  } else if (extension === "docx") {
    rawText = await extractDocx(bytes);
  } else {
    // txt / md — UTF-8 decode (fatal)
    rawText = decodeUtf8(bytes);
  }

  // 6. Reject empty / whitespace-only content
  assertNotEmpty(rawText, extension.toUpperCase());

  // 7. Cap extracted text
  const text = capText(rawText);

  return {
    extension,
    mimeType: resolvedMime,
    text,
    sizeBytes: bytes.length,
  };
}
