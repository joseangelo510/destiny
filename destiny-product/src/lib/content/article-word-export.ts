import sharp from "sharp";
import { buildWordDocument, type ArticleDraft } from "./article-draft";
import { renderInfographicSvg, type InfographicSpec } from "./article-generation";
import { createDocxFromHtml, type TrustedWordGraphic } from "@/lib/word-document";

export class InvalidArticleWordGraphicError extends Error {
  constructor() {
    super("Review the article graphics before exporting the Word document.");
  }
}

function validGraphic(value: unknown): value is InfographicSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const graphic = value as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => typeof graphic[key] === "string" && (!required || (graphic[key] as string).trim().length > 0) && (graphic[key] as string).length <= max;
  return text("id", 120)
    && ["steps", "comparison", "stat", "timeline", "checklist"].includes(graphic.template as string)
    && text("title", 200)
    && text("insight", 500, false)
    && text("sourceLabel", 300, false)
    && text("altText", 300)
    && (graphic.caption === undefined || (typeof graphic.caption === "string" && graphic.caption.length <= 500))
    && Array.isArray(graphic.items)
    && graphic.items.length <= 8
    && graphic.items.every((item: unknown) => typeof item === "string" && item.length <= 200);
}

export async function createArticleWordDocument(draft: ArticleDraft) {
  if (draft.infographics.length > 8 || !draft.infographics.every(validGraphic)) throw new InvalidArticleWordGraphicError();
  const graphics: TrustedWordGraphic[] = await Promise.all(draft.infographics.map(async (graphic) => {
    const png = await sharp(Buffer.from(renderInfographicSvg(graphic))).png().toBuffer();
    return {
      png,
      title: graphic.title,
      altText: graphic.altText,
      caption: graphic.caption?.trim() || graphic.sourceLabel,
      displayHeight: Math.round((330 + Math.max(1, graphic.items.length) * 105) * 620 / 1200),
    };
  }));
  return createDocxFromHtml(buildWordDocument(draft), draft.title, graphics);
}
