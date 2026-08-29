import { NextResponse } from "next/server";
import {
  DEFAULT_INFOGRAPHIC_RESEARCH_MODEL,
  INFOGRAPHIC_STYLE_OPTIONS,
  buildInfographicResearchPrompt,
  buildOpenAiInfographicResearchRequest,
  parseOpenAiInfographicResearch,
  type InfographicStyle,
} from "@/lib/content/infographic-generation";
import { createClient } from "@/lib/supabase/server";
import { isWebsiteId } from "@/lib/workspace-selection";

export const maxDuration = 120;

function string(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function infographicStyle(value: unknown): InfographicStyle {
  const supported = INFOGRAPHIC_STYLE_OPTIONS.find((option) => option.value === value);
  return supported?.value ?? "editorial";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = string(body.websiteId, 80);
  const keyword = string(body.keyword, 300);
  const style = infographicStyle(body.style);
  const specialInstructions = string(body.specialInstructions, 1200);
  if (!isWebsiteId(websiteId)) return NextResponse.json({ error: "Choose the website for this infographic." }, { status: 400 });
  if (keyword.length < 3) return NextResponse.json({ error: "Choose a keyword or enter a clear infographic topic." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OpenAI image generation is not connected yet." }, { status: 503 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub !== "string") return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website } = await supabase.from("websites")
    .select("id,business_name,products_services,problem_solved,ideal_customer,differentiation")
    .eq("id", websiteId)
    .maybeSingle();
  if (!website) return NextResponse.json({ error: "That website is not available in this account." }, { status: 404 });

  const prompt = buildInfographicResearchPrompt({
    keyword,
    businessName: website.business_name ?? "Your business",
    productsServices: website.products_services ?? "",
    problemSolved: website.problem_solved ?? "",
    idealCustomer: website.ideal_customer ?? "",
    differentiation: website.differentiation ?? "",
    style,
    specialInstructions,
  });
  const model = process.env.OPENAI_INFOGRAPHIC_RESEARCH_MODEL?.trim() || DEFAULT_INFOGRAPHIC_RESEARCH_MODEL;

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildOpenAiInfographicResearchRequest(prompt, model)),
      signal: AbortSignal.timeout(100_000),
    });
    const responseBody = await openAiResponse.json().catch(() => ({}));
    if (!openAiResponse.ok) {
      const code = (responseBody as { error?: { code?: string } }).error?.code ?? "unknown";
      console.error("infographic_research_provider", { status: openAiResponse.status, code });
      if (code === "credit_balance_exhausted") return NextResponse.json({ error: "OpenAI credits need to be added before Rebound SEO can research and generate infographics." }, { status: 503 });
      return NextResponse.json({ error: "Rebound SEO could not research this infographic yet. Try again in a moment." }, { status: 502 });
    }
    const result = parseOpenAiInfographicResearch(responseBody);
    return NextResponse.json({ plan: result.plan, model, retrievedSourceCount: result.retrievedUrls.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    console.error("infographic_research_failed", { error: cause instanceof Error ? cause.message : "unknown" });
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Rebound SEO could not complete the infographic research." }, { status: 502 });
  }
}
