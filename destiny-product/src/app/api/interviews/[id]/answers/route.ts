import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { websiteScopedClient } from "@/lib/interviews/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue the interview." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const questionId = text(body.questionId, 100);
  const answer = text(body.answer, 20000);
  const skip = body.skip === true;
  if (!UUID.test(id) || !UUID.test(questionId) || (!skip && !answer)) return NextResponse.json({ error: "Answer the question or choose Skip." }, { status: 400 });
  const db = websiteScopedClient(supabase);
  const { data: interview } = await db.from("interviews").select("id,organization_id,website_id,created_by,status,question_count").eq("id", id).maybeSingle();
  if (!interview || interview.created_by !== userId || interview.status === "complete") return NextResponse.json({ error: "That interview is not available to edit." }, { status: 404 });
  const { data: question } = await db.from("interview_questions").select("id,position").eq("id", questionId).eq("interview_id", id).maybeSingle();
  if (!question) return NextResponse.json({ error: "That question does not belong to this interview." }, { status: 404 });
  if (skip) {
    const { error } = await db.from("interview_questions").update({ skipped: true }).eq("id", questionId).eq("interview_id", id);
    if (error) return NextResponse.json({ error: "Rebound SEO could not save that skip." }, { status: 500 });
  } else {
    const { data: existing } = await db.from("interview_answers").select("id").eq("question_id", questionId).maybeSingle();
    if (!existing) {
      const { error } = await db.from("interview_answers").insert({
        organization_id: interview.organization_id,
        website_id: interview.website_id,
        interview_id: id,
        question_id: questionId,
        user_id: userId,
        verbatim_text: answer,
      });
      if (error) return NextResponse.json({ error: "Rebound SEO could not save that answer." }, { status: 500 });
    }
  }
  const nextPosition = Math.min(Number(interview.question_count), Number(question.position) + 1);
  await db.from("interviews").update({ current_position: nextPosition }).eq("id", id);
  return NextResponse.json({ saved: true, nextPosition });
}
