import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInterviewQuestions, type InterviewTopic } from "@/lib/interviews/interviews";
import { websiteScopedClient } from "@/lib/interviews/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function topic(value: unknown): InterviewTopic | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const title = text(row.title, 240);
  if (!title) return null;
  return {
    title,
    angle: text(row.angle, 1000),
    whyNow: text(row.whyNow, 1000),
    focusKeyword: text(row.focusKeyword, 300) || title,
    searchVolume: Math.max(0, Number(row.searchVolume ?? 0)),
    estimatedMinutes: Math.min(30, Math.max(5, Number(row.estimatedMinutes ?? 10))),
    questionCount: 7,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to start an interview." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const websiteId = text(body.websiteId, 100);
  const auditId = text(body.auditId, 100);
  const chosenTopic = topic(body.topic);
  if (!UUID.test(websiteId) || (auditId && !UUID.test(auditId)) || !chosenTopic) {
    return NextResponse.json({ error: "Choose a valid website and interview topic." }, { status: 400 });
  }
  const db = websiteScopedClient(supabase);
  const { data: website } = await db.from("websites")
    .select("id,organization_id,business_name,products_services,ideal_customer,differentiation")
    .eq("id", websiteId)
    .maybeSingle();
  if (!website) return NextResponse.json({ error: "That website is not available in this workspace." }, { status: 404 });
  if (auditId) {
    const { data: audit } = await db.from("audits").select("id").eq("id", auditId).eq("website_id", websiteId).maybeSingle();
    if (!audit) return NextResponse.json({ error: "That audit does not belong to this website." }, { status: 404 });
  }
  const questions = buildInterviewQuestions({
    topicTitle: chosenTopic.title,
    focusKeyword: chosenTopic.focusKeyword,
    businessName: String(website.business_name ?? "Your business"),
    idealCustomer: String(website.ideal_customer ?? "your customers"),
    productsServices: String(website.products_services ?? ""),
    differentiation: String(website.differentiation ?? ""),
  });
  const { data: interview, error: interviewError } = await db.from("interviews").insert({
    organization_id: website.organization_id,
    website_id: websiteId,
    audit_id: auditId || null,
    created_by: userId,
    topic_title: chosenTopic.title,
    focus_keyword: chosenTopic.focusKeyword,
    mode: "typed",
    status: "in_progress",
    question_count: questions.length,
    current_position: 1,
    consent_snapshot: { typed_source_notice: true, audio_retention_days: 30, voice_library_applies_automatically: true, primary_voice_count: 1, interviewer: "Rebound SEO" },
  }).select("id,topic_title,focus_keyword").single();
  if (interviewError || !interview) return NextResponse.json({ error: "Rebound SEO could not create this interview." }, { status: 500 });
  const { data: questionRows, error: questionError } = await db.from("interview_questions").insert(questions.map((question) => ({
    organization_id: website.organization_id,
    website_id: websiteId,
    interview_id: interview.id,
    position: question.position,
    kind: question.kind,
    text: question.text,
  }))).select("id,position,kind,text").order("position");
  if (questionError || !questionRows?.length) {
    await db.from("interviews").delete().eq("id", interview.id);
    return NextResponse.json({ error: "Rebound SEO could not prepare the interview questions." }, { status: 500 });
  }
  return NextResponse.json({ interview: {
    id: interview.id,
    topicTitle: interview.topic_title,
    focusKeyword: interview.focus_keyword,
    questions: questionRows.map((question) => ({ id: question.id, position: question.position, kind: question.kind, text: question.text })),
  } }, { status: 201 });
}
