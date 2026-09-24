import htmlToDocx from "html-to-docx";

export function sanitizeDocxHtml(html: string) {
  return html
    .replace(/<\s*img\b[^>]*>/gi, "")
    .replace(/<\s*source\b[^>]*>/gi, "")
    .replace(/<\/?\s*picture\b[^>]*>/gi, "");
}

export type TrustedWordGraphic = {
  png: Buffer;
  title: string;
  altText: string;
  caption: string;
  displayHeight: number;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export async function createDocxFromHtml(html: string, title: string, trustedGraphics: TrustedWordGraphic[] = []) {
  const sanitized = sanitizeDocxHtml(html);
  const graphicsHtml = trustedGraphics.length
    ? `<h2>Reviewed graphics</h2>${trustedGraphics.map((graphic) => `<h3>${escapeHtml(graphic.title)}</h3><p><img src="data:image/png;base64,${graphic.png.toString("base64")}" alt="${escapeHtml(graphic.altText)}" width="620" height="${graphic.displayHeight}"></p><p>${escapeHtml(graphic.caption)}</p>`).join("")}`
    : "";
  const documentHtml = graphicsHtml ? sanitized.replace(/<\/body>/i, `${graphicsHtml}</body>`) : sanitized;
  const result = await htmlToDocx(documentHtml, null, {
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
