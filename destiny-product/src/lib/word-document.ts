import htmlToDocx from "html-to-docx";

export function sanitizeDocxHtml(html: string) {
  return html
    .replace(/<\s*img\b[^>]*>/gi, "")
    .replace(/<\s*source\b[^>]*>/gi, "")
    .replace(/<\/?\s*picture\b[^>]*>/gi, "");
}

export async function createDocxFromHtml(html: string, title: string) {
  const result = await htmlToDocx(sanitizeDocxHtml(html), null, {
    title,
    creator: "Rebound SEO",
    description: "Editable document created by Rebound SEO",
    font: "Arial",
    fontSize: 22,
    lang: "en-US",
    pageNumber: true,
    footer: true,
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
  });
  if (Buffer.isBuffer(result)) return result;
  return Buffer.from(await result.arrayBuffer());
}

export function safeDocumentName(value: string, fallback = "destiny-document") {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || fallback;
}
