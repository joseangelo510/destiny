import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInterviewArticleDraft } from "@/lib/interviews/interviews";
import { websiteScopedClient } from "@/lib/interviews/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to create the article draft." }, { status: 401 });
  const db = websiteScopedClient(supabase);
  const { data: interview } = await db.from("interviews").select("id,organization_id,website_id,audit_id,created_by,topic_title,focus_keyword,status").eq("id", id).eq("status", "complete").maybeSingle();
  if (!interview || interview.created_by !== userId || !interview.audit_id) return NextResponse.json({ error: "Finish the interview and website audit before creating the article." }, { status: 404 });
  const [{ data: website }, { data: questionRows }, { data: answerRows }] = await Promise.all([
    db.from("websites").select("business_name").eq("id", interview.website_id).maybeSingle(),
    db.from("interview_questions").select("id,text,position").eq("interview_id", id).order("position"),
    db.from("interview_answers").select("question_id,verbatim_text").eq("interview_id", id).is("retracted_at", null),
  ]);
  if (!website || !answerRows?.length) return NextResponse.json({ error: "Destiny could not find the saved interview answers." }, { status: 404 });
  const answerByQuestion = new Map(answerRows.map((answer) => [String(answer.question_id), String(answer.verbatim_text)]));
  const draft = buildInterviewArticleDraft({
    interviewId: id,
    topicTitle: String(interview.topic_title),
    focusKeyword: String(interview.focus_keyword),
    businessName: String(website.business_name ?? "Your business"),
    answers: (questionRows ?? []).flatMap((question) => {
      const verbatimText = answerByQuestion.get(String(question.id));
      return verbatimText ? [{ question: String(question.text), verbatimText }] : [];
    }),
  });
  const { data: existing } = await db.from("article_drafts").select("id,draft").eq("website_id", interview.website_id).eq("audit_id", interview.audit_id).eq("keyword", draft.keyword).maybeSingle();
  const existingDraft = existing?.draft && typeof existing.draft === "object" && !Array.isArray(existing.draft) ? existing.draft as Record<string, unknown> : null;
  if (existing && existingDraft?.generationStatus === "generated") {
    await db.from("article_drafts").update({ interview_id: id }).eq("id", existing.id);
  } else {
    const { error } = await db.from("article_drafts").upsert({
      organization_id: interview.organization_id,
      website_id: interview.website_id,
      audit_id: interview.audit_id,
      user_id: userId,
      keyword: draft.keyword,
      draft,
      interview_id: id,
    }, { onConflict: "website_id,audit_id,keyword" });
    if (error) return NextResponse.json({ error: "Destiny could not prepare the Content Studio draft." }, { status: 500 });
  }
  return NextResponse.json({ contentUrl: `/content?interview=${encodeURIComponent(id)}#article-review-workspace` });
}
