/**
 * repurpose-source.test.ts
 *
 * Vitest unit tests for the secure file-ingestion library.
 * Tests are ordered: new failing → existing passing.
 * Uses real mammoth and pdfjs-dist against synthetic in-memory byte arrays.
 * No external network calls.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_DOCX_COMPRESSION_RATIO,
  MAX_DOCX_UNCOMPRESSED_BYTES,
  MAX_DOCX_ZIP_ENTRIES,
  MAX_FILE_BYTES,
  MAX_PDF_PAGES,
  MAX_TEXT_CHARS,
  RepurposeSourceError,
  ingestSourceFile,
} from "./repurpose-source";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Build a minimal, valid DOCX ZIP in pure JS (stored / no-compression).
 * Parts needed by mammoth:
 *   [Content_Types].xml, _rels/.rels, word/_rels/document.xml.rels, word/document.xml
 */
async function buildMinimalDocx(text: string): Promise<Uint8Array> {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

  const entries: Array<{ name: string; data: Uint8Array }> = [
    { name: "[Content_Types].xml", data: utf8(contentTypes) },
    { name: "_rels/.rels", data: utf8(rels) },
    { name: "word/_rels/document.xml.rels", data: utf8(docRels) },
    { name: "word/document.xml", data: utf8(document) },
  ];

  return buildStoredZip(entries);
}

/** Build a stored (no-compression, method=0) ZIP from named entries. */
function buildStoredZip(
  entries: Array<{ name: string; data: Uint8Array }>,
): Uint8Array {
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const lh = new Uint8Array(30 + nameBytes.length + data.length);
    const lhView = new DataView(lh.buffer);

    lhView.setUint32(0, 0x04034b50, true); // signature
    lhView.setUint16(4, 20, true); // version needed
    lhView.setUint16(6, 0, true); // flags
    lhView.setUint16(8, 0, true); // method (stored)
    lhView.setUint16(10, 0, true); // mod time
    lhView.setUint16(12, 0, true); // mod date
    lhView.setUint32(14, crc, true); // crc32
    lhView.setUint32(18, data.length, true); // compressed size
    lhView.setUint32(22, data.length, true); // uncompressed size
    lhView.setUint16(26, nameBytes.length, true); // name length
    lhView.setUint16(28, 0, true); // extra length

    lh.set(nameBytes, 30);
    lh.set(data, 30 + nameBytes.length);

    localOffsets.push(offset);
    localHeaders.push(lh);
    offset += lh.length;
  }

  const centralHeaders: Uint8Array[] = [];
  for (let i = 0; i < entries.length; i++) {
    const { name, data } = entries[i];
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const chView = new DataView(ch.buffer);

    chView.setUint32(0, 0x02014b50, true); // signature
    chView.setUint16(4, 20, true); // version made by
    chView.setUint16(6, 20, true); // version needed
    chView.setUint16(8, 0, true); // flags (NOT encrypted)
    chView.setUint16(10, 0, true); // method
    chView.setUint16(12, 0, true); // mod time
    chView.setUint16(14, 0, true); // mod date
    chView.setUint32(16, crc, true); // crc32
    chView.setUint32(20, data.length, true); // compressed
    chView.setUint32(24, data.length, true); // uncompressed
    chView.setUint16(28, nameBytes.length, true); // name len
    chView.setUint16(30, 0, true); // extra len
    chView.setUint16(32, 0, true); // comment len
    chView.setUint16(34, 0, true); // disk start
    chView.setUint16(36, 0, true); // int attr
    chView.setUint32(38, 0, true); // ext attr
    chView.setUint32(42, localOffsets[i], true); // local offset

    ch.set(nameBytes, 46);
    centralHeaders.push(ch);
  }

  const centralSize = centralHeaders.reduce((s, h) => s + h.length, 0);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  const total = offset + centralSize + eocd.length;
  const zip = new Uint8Array(total);
  let pos = 0;
  for (const lh of localHeaders) { zip.set(lh, pos); pos += lh.length; }
  for (const ch of centralHeaders) { zip.set(ch, pos); pos += ch.length; }
  zip.set(eocd, pos);
  return zip;
}

/**
 * Build a DOCX ZIP where the central directory declares the encryption bit (flag bit 0)
 * on one entry, to test encrypted-entry rejection.
 */
async function buildEncryptedDocx(): Promise<Uint8Array> {
  // Build normally first
  const normal = await buildMinimalDocx("encrypted content");
  // Find the central directory in the ZIP and flip bit 0 of the general flags
  // of the first central directory header.
  const view = new DataView(normal.buffer);
  const len = normal.byteLength;

  // Find EOCD
  let eocdOffset = -1;
  for (let i = len - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) throw new Error("No EOCD");

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  // central dir header general flags at offset +8
  const flags = view.getUint16(cdOffset + 8, true);
  view.setUint16(cdOffset + 8, flags | 0x01, true); // set encryption bit
  return normal;
}

/** Simple CRC-32 implementation (lookup table). */
function crc32(data: Uint8Array): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: Uint32Array | undefined;
function makeCrcTable(): Uint32Array {
  if (_crcTable) return _crcTable;
  _crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    _crcTable[n] = c;
  }
  return _crcTable;
}

/**
 * Minimal valid PDF with real text-layer content.
 */
function makeTextPdf(text: string = "Hello PDF"): Uint8Array {
  const safeText = text.slice(0, 200).replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 12 Tf 72 720 Td (${safeText}) Tj ET`;
  const streamLen = stream.length;

  const objs: string[] = [];
  objs.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objs.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objs.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
  );
  objs.push(
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj`,
  );
  objs.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  );

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [];
  for (const obj of objs) { offsets.push(body.length); body += obj + "\n"; }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objs.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return utf8(body + xref + trailer);
}

/** PDF with no text items (image-only simulation). */
function makeImageOnlyPdf(): Uint8Array {
  const objs: string[] = [];
  objs.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objs.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objs.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj",
  );
  objs.push("4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj");

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [];
  for (const obj of objs) { offsets.push(body.length); body += obj + "\n"; }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objs.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return utf8(body + xref + trailer);
}

/**
 * Build a multi-page PDF with N pages each containing text.
 * Used for page-count cap tests.
 */
function makeMultiPagePdf(pageCount: number): Uint8Array {
  const pageObjIds: number[] = [];
  const objs: string[] = [];

  // obj 1: catalog (placeholder, filled after pages known)
  objs.push(""); // index 0 → obj 1
  // obj 2: Pages dictionary (placeholder)
  objs.push(""); // index 1 → obj 2

  let nextObjId = 3;

  for (let p = 0; p < pageCount; p++) {
    const contentObjId = nextObjId++;
    const pageObjId = nextObjId++;
    pageObjIds.push(pageObjId);

    const stream = `BT /F1 12 Tf 72 720 Td (Page ${p + 1}) Tj ET`;
    objs.push(
      `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    );
    objs.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${nextObjId} 0 R >> >> >>\nendobj`,
    );
  }

  const fontObjId = nextObjId++;
  objs.push(
    `${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`,
  );

  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objs[0] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
  objs[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj`;

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [];
  for (const obj of objs) { offsets.push(body.length); body += obj + "\n"; }

  const xrefOffset = body.length;
  const totalObjs = objs.length + 1;
  let xref = `xref\n0 ${totalObjs}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return utf8(body + xref + trailer);
}

// ─── NEW: NO_TEXT tests ───────────────────────────────────────────────────────

describe("ingestSourceFile – NO_TEXT rejection", () => {
  it("rejects a whitespace-only TXT file with NO_TEXT", async () => {
    const blank = utf8("   \n\t\n   ");
    await expect(
      ingestSourceFile("blank.txt", "text/plain", blank),
    ).rejects.toMatchObject({ code: "NO_TEXT", name: "RepurposeSourceError" });
  });

  it("rejects a whitespace-only MD file with NO_TEXT", async () => {
    const blank = utf8("\n\n\n");
    await expect(
      ingestSourceFile("blank.md", "text/markdown", blank),
    ).rejects.toMatchObject({ code: "NO_TEXT" });
  });

  it("rejects an empty TXT file with NO_TEXT", async () => {
    await expect(
      ingestSourceFile("empty.txt", "text/plain", new Uint8Array(0)),
    ).rejects.toMatchObject({ code: "NO_TEXT" });
  });

  it("rejects a 20 MB TXT file of spaces with NO_TEXT (not OVERSIZED)", async () => {
    const allSpaces = new Uint8Array(MAX_FILE_BYTES).fill(0x20);
    await expect(
      ingestSourceFile("big.txt", "text/plain", allSpaces),
    ).rejects.toMatchObject({ code: "NO_TEXT" });
  });

  it(
    "rejects an image-only DOCX (all whitespace body) with NO_TEXT",
    async () => {
      // Build a DOCX with only whitespace inside the <w:t> element
      const docxBytes = await buildMinimalDocx("   ");
      await expect(
        ingestSourceFile(
          "blank.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          docxBytes,
        ),
      ).rejects.toMatchObject({ code: "NO_TEXT" });
    },
    20_000,
  );

  it(
    "rejects an image-only PDF with IMAGE_ONLY_PDF (not NO_TEXT)",
    async () => {
      // Image-only PDFs have their own error code
      const pdfBytes = makeImageOnlyPdf();
      await expect(
        ingestSourceFile("scanned.pdf", "application/pdf", pdfBytes),
      ).rejects.toMatchObject({ code: "IMAGE_ONLY_PDF" });
    },
    20_000,
  );
});

// ─── NEW: empty / absent MIME tests ──────────────────────────────────────────

describe("ingestSourceFile – empty declared MIME", () => {
  it("accepts an empty MIME for TXT and returns canonical text/plain", async () => {
    const result = await ingestSourceFile("notes.txt", "", utf8("hello world content"));
    expect(result.mimeType).toBe("text/plain");
    expect(result.extension).toBe("txt");
  });

  it("accepts an empty MIME for MD and returns canonical text/markdown", async () => {
    const result = await ingestSourceFile("post.md", "", utf8("# Hello"));
    expect(result.mimeType).toBe("text/markdown");
  });

  it("accepts an empty MIME for PDF when magic bytes pass", async () => {
    const pdfBytes = makeTextPdf("Hello empty-mime PDF");
    const result = await ingestSourceFile("doc.pdf", "", pdfBytes);
    expect(result.mimeType).toBe("application/pdf");
  }, 20_000);

  it("accepts an empty MIME for DOCX when magic bytes pass", async () => {
    const docxBytes = await buildMinimalDocx("Empty MIME DOCX content");
    const result = await ingestSourceFile("doc.docx", "", docxBytes);
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }, 20_000);

  it("still rejects a mismatched non-empty MIME for PDF", async () => {
    const pdfBytes = makeTextPdf();
    await expect(
      ingestSourceFile("doc.pdf", "image/jpeg", pdfBytes),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});

// ─── NEW: PDF page-count cap tests ───────────────────────────────────────────

describe("ingestSourceFile – PDF page-count cap", () => {
  it(
    `raises TOO_COMPLEX for a PDF with more than ${MAX_PDF_PAGES} pages`,
    async () => {
      const pdfBytes = makeMultiPagePdf(MAX_PDF_PAGES + 1);
      await expect(
        ingestSourceFile("huge.pdf", "application/pdf", pdfBytes),
      ).rejects.toMatchObject({ code: "TOO_COMPLEX", name: "RepurposeSourceError" });
    },
    60_000,
  );

  it(
    `accepts a PDF at exactly ${MAX_PDF_PAGES} pages`,
    async () => {
      const pdfBytes = makeMultiPagePdf(MAX_PDF_PAGES);
      const result = await ingestSourceFile("big.pdf", "application/pdf", pdfBytes);
      expect(result.text).toContain("Page 1");
    },
    60_000,
  );
});

// ─── NEW: DOCX ZIP validation tests ──────────────────────────────────────────

describe("ingestSourceFile – DOCX ZIP central-directory validation", () => {
  it(
    "rejects an encrypted DOCX (encryption flag set) with MALFORMED",
    async () => {
      const encryptedBytes = await buildEncryptedDocx();
      await expect(
        ingestSourceFile(
          "encrypted.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          encryptedBytes,
        ),
      ).rejects.toMatchObject({ code: "MALFORMED" });
    },
    20_000,
  );

  it("rejects a DOCX ZIP missing [Content_Types].xml with MALFORMED", async () => {
    // Build a ZIP without [Content_Types].xml
    const entries: Array<{ name: string; data: Uint8Array }> = [
      { name: "_rels/.rels", data: utf8("<rels/>") },
      { name: "word/document.xml", data: utf8("<document/>") },
    ];
    const zip = buildStoredZip(entries);
    // Fix the magic bytes (it's a PK ZIP)
    await expect(
      ingestSourceFile(
        "bad.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        zip,
      ),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it("rejects a DOCX ZIP missing word/document.xml with MALFORMED", async () => {
    const entries: Array<{ name: string; data: Uint8Array }> = [
      { name: "[Content_Types].xml", data: utf8("<types/>") },
      { name: "_rels/.rels", data: utf8("<rels/>") },
    ];
    const zip = buildStoredZip(entries);
    await expect(
      ingestSourceFile(
        "nodoc.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        zip,
      ),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it(
    `rejects a DOCX ZIP with more than ${MAX_DOCX_ZIP_ENTRIES} entries (TOO_COMPLEX)`,
    async () => {
      // Build a ZIP with MAX_DOCX_ZIP_ENTRIES+1 entries
      const entries: Array<{ name: string; data: Uint8Array }> = [];
      // Must include required parts
      entries.push({ name: "[Content_Types].xml", data: utf8("<types/>") });
      entries.push({ name: "word/document.xml", data: utf8("<doc/>") });
      for (let i = 0; i < MAX_DOCX_ZIP_ENTRIES; i++) {
        entries.push({ name: `extra/file${i}.xml`, data: utf8("x") });
      }
      const zip = buildStoredZip(entries);
      await expect(
        ingestSourceFile(
          "bomb.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          zip,
        ),
      ).rejects.toMatchObject({ code: "TOO_COMPLEX" });
    },
    30_000,
  );

  it(
    `rejects a DOCX with total uncompressed > ${MAX_DOCX_UNCOMPRESSED_BYTES / 1024 / 1024} MB (TOO_COMPLEX)`,
    () => {
      // We can't actually build 40 MB in a test easily, but we can verify the
      // validator logic independently by patching the central directory sizes.
      // Build a minimal valid DOCX and then corrupt the uncompressed-size field
      // in the central directory to declare 41 MB.
      return buildMinimalDocx("test content").then((docxBytes) => {
        const view = new DataView(docxBytes.buffer);
        const len = docxBytes.byteLength;

        // Find EOCD
        let eocdOffset = -1;
        for (let i = len - 22; i >= 0; i--) {
          if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
        }
        const cdOffset = view.getUint32(eocdOffset + 16, true);

        // Patch the uncompressed size of the first central-dir entry (offset +24)
        // to 41 MB
        view.setUint32(cdOffset + 24, MAX_DOCX_UNCOMPRESSED_BYTES + 1, true);

        return expect(
          ingestSourceFile(
            "bigbomb.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docxBytes,
          ),
        ).rejects.toMatchObject({ code: "TOO_COMPLEX" });
      });
    },
    20_000,
  );

  it(
    "rejects a DOCX with extreme compression ratio (zip bomb) as MALFORMED",
    () => {
      return buildMinimalDocx("content").then((docxBytes) => {
        const view = new DataView(docxBytes.buffer);
        const len = docxBytes.byteLength;

        let eocdOffset = -1;
        for (let i = len - 22; i >= 0; i--) {
          if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
        }
        const cdOffset = view.getUint32(eocdOffset + 16, true);

        // Change the first entry's method from 0 (stored) to 8 (deflate)
        // so the ratio check fires, then set compressedSize=1, uncompressedSize=big
        view.setUint16(cdOffset + 10, 8, true); // method = deflate
        view.setUint32(cdOffset + 20, 1, true); // compressed = 1 byte
        view.setUint32(cdOffset + 24, MAX_DOCX_COMPRESSION_RATIO * 10 + 1, true); // ratio > limit

        return expect(
          ingestSourceFile(
            "bomb.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docxBytes,
          ),
        ).rejects.toMatchObject({ code: "MALFORMED" });
      });
    },
    20_000,
  );

  it(
    "accepts a valid DOCX through ZIP validation and extracts text",
    async () => {
      const docxBytes = await buildMinimalDocx("ZIP validation passes");
      const result = await ingestSourceFile(
        "valid.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docxBytes,
      );
      expect(result.text).toContain("ZIP validation passes");
    },
    20_000,
  );
});

// ─── Existing: size cap ───────────────────────────────────────────────────────

describe("ingestSourceFile – size cap", () => {
  it("rejects a file over 20 MB with OVERSIZED error", async () => {
    const oversized = new Uint8Array(MAX_FILE_BYTES + 1);
    await expect(
      ingestSourceFile("doc.txt", "text/plain", oversized),
    ).rejects.toMatchObject({
      code: "OVERSIZED",
      name: "RepurposeSourceError",
    });
  });

  it("accepts a non-empty file exactly at the 20 MB limit", async () => {
    // Fill with 'A' (not spaces) so it passes NO_TEXT check
    const atLimit = new Uint8Array(MAX_FILE_BYTES).fill(0x41); // 'A'
    const result = await ingestSourceFile("notes.txt", "text/plain", atLimit);
    expect(result.sizeBytes).toBe(MAX_FILE_BYTES);
  });
});

// ─── Existing: extension validation ──────────────────────────────────────────

describe("ingestSourceFile – extension validation", () => {
  it("rejects an unsupported .png extension", async () => {
    const bytes = utf8("fake image content");
    await expect(
      ingestSourceFile("photo.png", "image/png", bytes),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("rejects a file with no extension", async () => {
    await expect(
      ingestSourceFile("README", "text/plain", utf8("hello")),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("rejects a .pdf extension with mismatched MIME", async () => {
    const pdfBytes = makeTextPdf();
    await expect(
      ingestSourceFile("doc.pdf", "image/jpeg", pdfBytes),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("rejects a .docx extension with mismatched MIME", async () => {
    const docxBytes = await buildMinimalDocx("test");
    await expect(
      ingestSourceFile("file.docx", "text/plain", docxBytes),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});

// ─── Existing: magic-byte validation ─────────────────────────────────────────

describe("ingestSourceFile – magic-byte validation", () => {
  it("rejects a .pdf file with wrong magic bytes (not %PDF)", async () => {
    const fakePdf = utf8("This is not a PDF");
    await expect(
      ingestSourceFile("trick.pdf", "application/pdf", fakePdf),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it("rejects a .docx file with wrong magic bytes (not PK ZIP)", async () => {
    const fakeDocx = utf8("Not a ZIP file");
    await expect(
      ingestSourceFile(
        "trick.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fakeDocx,
      ),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });
});

// ─── Existing: TXT ingestion ──────────────────────────────────────────────────

describe("ingestSourceFile – TXT ingestion", () => {
  it("extracts plain text from a .txt file", async () => {
    const text = "Hello, repurpose world!";
    const result = await ingestSourceFile("notes.txt", "text/plain", utf8(text));
    expect(result.text).toBe(text);
    expect(result.extension).toBe("txt");
    expect(result.mimeType).toBe("text/plain");
  });

  it("caps extracted text at MAX_TEXT_CHARS", async () => {
    const longText = "A".repeat(MAX_TEXT_CHARS + 1000);
    const result = await ingestSourceFile("big.txt", "text/plain", utf8(longText));
    expect(result.text.length).toBe(MAX_TEXT_CHARS);
  });

  it("rejects invalid UTF-8 bytes with UTF8_DECODE error", async () => {
    const invalid = new Uint8Array([0xff, 0xfe, 0x00]);
    await expect(
      ingestSourceFile("bad.txt", "text/plain", invalid),
    ).rejects.toMatchObject({ code: "UTF8_DECODE" });
  });

  it("accepts application/octet-stream MIME for .txt files and returns canonical MIME", async () => {
    const result = await ingestSourceFile(
      "file.txt",
      "application/octet-stream",
      utf8("hello world content"),
    );
    // octet-stream is treated as empty/generic → resolved to canonical
    expect(result.mimeType).toBe("text/plain");
  });
});

// ─── Existing: Markdown ingestion ────────────────────────────────────────────

describe("ingestSourceFile – Markdown ingestion", () => {
  it("extracts text from a .md file", async () => {
    const md = "# Title\n\nParagraph text.";
    const result = await ingestSourceFile("post.md", "text/markdown", utf8(md));
    expect(result.text).toBe(md);
    expect(result.extension).toBe("md");
  });

  it("accepts text/plain MIME for .md files", async () => {
    const result = await ingestSourceFile(
      "readme.md",
      "text/plain",
      utf8("## Heading with content"),
    );
    expect(result.extension).toBe("md");
    expect(result.text).toBe("## Heading with content");
  });
});

// ─── Existing: PDF ingestion ──────────────────────────────────────────────────

describe("ingestSourceFile – PDF ingestion", () => {
  it(
    "extracts text from a text-layer PDF",
    async () => {
      const pdfBytes = makeTextPdf("Hello PDF World");
      const result = await ingestSourceFile(
        "report.pdf",
        "application/pdf",
        pdfBytes,
      );
      expect(result.text).toContain("Hello PDF World");
      expect(result.extension).toBe("pdf");
    },
    20_000,
  );

  it(
    "raises IMAGE_ONLY_PDF for a scanned / image-only PDF",
    async () => {
      const pdfBytes = makeImageOnlyPdf();
      await expect(
        ingestSourceFile("scanned.pdf", "application/pdf", pdfBytes),
      ).rejects.toMatchObject({ code: "IMAGE_ONLY_PDF" });
    },
    20_000,
  );

  it("raises MALFORMED for bytes that are not a valid PDF", async () => {
    const corrupt = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...utf8("corrupt")]);
    await expect(
      ingestSourceFile("corrupt.pdf", "application/pdf", corrupt),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });
});

// ─── Existing: DOCX ingestion ─────────────────────────────────────────────────

describe("ingestSourceFile – DOCX ingestion", () => {
  it(
    "extracts text from a minimal DOCX",
    async () => {
      const docxBytes = await buildMinimalDocx("Hello DOCX World");
      const result = await ingestSourceFile(
        "essay.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docxBytes,
      );
      expect(result.text).toContain("Hello DOCX World");
      expect(result.extension).toBe("docx");
    },
    20_000,
  );

  it(
    "accepts application/zip MIME for .docx files",
    async () => {
      const docxBytes = await buildMinimalDocx("Zipped DOCX");
      const result = await ingestSourceFile(
        "essay.docx",
        "application/zip",
        docxBytes,
      );
      expect(result.text).toContain("Zipped DOCX");
    },
    20_000,
  );
});

// ─── RepurposeSourceError ─────────────────────────────────────────────────────

describe("RepurposeSourceError", () => {
  it("has expected name and code properties", () => {
    const err = new RepurposeSourceError("test message", "OVERSIZED");
    expect(err.name).toBe("RepurposeSourceError");
    expect(err.code).toBe("OVERSIZED");
    expect(err.message).toBe("test message");
    expect(err instanceof Error).toBe(true);
  });

  it("supports NO_TEXT code", () => {
    const err = new RepurposeSourceError("no text", "NO_TEXT");
    expect(err.code).toBe("NO_TEXT");
  });

  it("supports TOO_COMPLEX code", () => {
    const err = new RepurposeSourceError("too complex", "TOO_COMPLEX");
    expect(err.code).toBe("TOO_COMPLEX");
  });
});
