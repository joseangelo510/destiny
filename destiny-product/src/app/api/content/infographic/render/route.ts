import sharp from "sharp";
import {
  DEFAULT_INFOGRAPHIC_IMAGE_MODEL,
  INFOGRAPHIC_HEIGHT,
  INFOGRAPHIC_STYLE_OPTIONS,
  INFOGRAPHIC_WIDTH,
  buildInfographicArtPrompt,
  infographicPlanIssues,
  renderInfographicOverlaySvg,
  type InfographicPlan,
  type InfographicStyle,
} from "@/lib/content/infographic-generation";
import { createClient } from "@/lib/supabase/server";
import { isWebsiteId } from "@/lib/workspace-selection";

export const maxDuration = 120;

function style(value: unknown): InfographicStyle {
  return INFOGRAPHIC_STYLE_OPTIONS.find((option) => option.value === value)?.value ?? "editorial";
}

function plan(value: unknown): InfographicPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<InfographicPlan>;
  if (!candidate.title?.trim() || !candidate.article?.markdown?.trim() || !Array.isArray(candidate.sections) || !Array.isArray(candidate.sources) || !Array.isArray(candidate.repurposeCards)) return null;
  return candidate as InfographicPlan;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { websiteId?: unknown; plan?: unknown; style?: unknown };
  if (!isWebsiteId(payload.websiteId)) return Response.json({ error: "Choose the website for this infographic." }, { status: 400 });
  const infographicPlan = plan(payload.plan);
  if (!infographicPlan) return Response.json({ error: "Review the infographic research before creating the visual." }, { status: 400 });
  const issues = infographicPlanIssues(infographicPlan, new Set(infographicPlan.sources.map((source) => source.url)));
  if (issues.length) return Response.json({ error: issues[0] }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "OpenAI image generation is not connected yet." }, { status: 503 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return Response.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites").select("id").eq("id", payload.websiteId).maybeSingle();
  if (!website) return Response.json({ error: "That website is not available in this account." }, { status: 404 });

  try {
    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_INFOGRAPHIC_IMAGE_MODEL?.trim() || DEFAULT_INFOGRAPHIC_IMAGE_MODEL,
        prompt: buildInfographicArtPrompt(infographicPlan, style(payload.style)),
        n: 1,
        size: `${INFOGRAPHIC_WIDTH}x${INFOGRAPHIC_HEIGHT}`,
        quality: "high",
        output_format: "png",
        background: "opaque",
        moderation: "auto",
      }),
      signal: AbortSignal.timeout(110_000),
    });
    const result = await imageResponse.json().catch(() => ({})) as { data?: Array<{ b64_json?: string }>; error?: { code?: string } };
    if (!imageResponse.ok || !result.data?.[0]?.b64_json) {
      const code = result.error?.code ?? "missing_image";
      console.error("infographic_image_provider", { status: imageResponse.status, code });
      if (code === "credit_balance_exhausted") return Response.json({ error: "OpenAI credits need to be added before Destiny can create infographics." }, { status: 503 });
      return Response.json({ error: "Destiny could not create the visual yet. Try again in a moment." }, { status: 502 });
    }
    const visualFoundation = await sharp(Buffer.from(result.data[0].b64_json, "base64"))
      .resize(INFOGRAPHIC_WIDTH, INFOGRAPHIC_HEIGHT, { fit: "cover" })
      .png()
      .toBuffer();
    const completed = await sharp(visualFoundation)
      .composite([{ input: Buffer.from(renderInfographicOverlaySvg(infographicPlan)) }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    return new Response(new Uint8Array(completed), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename=destiny-infographic.png",
        "Content-Type": "image/png",
      },
    });
  } catch (cause) {
    console.error("infographic_image_failed", { error: cause instanceof Error ? cause.message : "unknown" });
    return Response.json({ error: "Destiny could not finish the visual. Try again in a moment." }, { status: 502 });
  }
}
