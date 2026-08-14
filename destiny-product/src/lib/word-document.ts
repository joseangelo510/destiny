import htmlToDocx from "html-to-docx";

export async function createDocxFromHtml(html: string, title: string) {
  const result = await htmlToDocx(html, null, {
    title,
    creator: "Destiny",
    description: "Editable document created by Destiny",
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
