import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildLibraryRows, voiceLibraryView, websiteScopedClient, type InterviewAnswerSource } from "@/lib/interviews/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to finish the interview." }, { status: 401 });
  const db = websiteScopedClient(supabase);
  const { data: interview } = await db.from("interviews").select("id,organization_id,website_id,created_by,status").eq("id", id).maybeSingle();
  if (!interview || interview.created_by !== userId) return NextResponse.json({ error: "That interview is not available." }, { status: 404 });
  const [{ data: questionRows }, { data: answerRows }] = await Promise.all([
    db.from("interview_questions").select("id,interview_id,text,kind,position,skipped").eq("interview_id", id).order("position"),
    db.from("interview_answers").select("id,interview_id,question_id,verbatim_text").eq("interview_id", id).is("retracted_at", null).order("created_at"),
  ]);
  const answers = (answerRows ?? []) as InterviewAnswerSource[];
  if (!answers.length) return NextResponse.json({ error: "Add at least one answer before finishing the interview." }, { status: 400 });
  const libraryRows = buildLibraryRows({
    organizationId: String(interview.organization_id),
    websiteId: String(interview.website_id),
    interviewId: id,
    questions: (questionRows ?? []).map((row) => ({ id: String(row.id), interview_id: String(row.interview_id), text: String(row.text), kind: String(row.kind), position: Number(row.position) })),
    answers,
  });
  const { data: storedItems, error: libraryError } = libraryRows.length
    ? await db.from("voice_library_items").upsert(libraryRows, { onConflict: "answer_id,type" }).select("id,interview_id,answer_id,type,title,body,status")
    : { data: [], error: null };
  if (libraryError) return NextResponse.json({ error: "Your answers are safe, but Rebound SEO could not update the Voice Library yet." }, { status: 500 });
  const { error: completionError } = await db.from("interviews").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", id);
  if (completionError) return NextResponse.json({ error: "Your answers are safe, but Rebound SEO could not finish the interview yet." }, { status: 500 });
  const questionById = new Map((questionRows ?? []).map((row) => [String(row.id), String(row.text)]));
  const answerById = new Map(answers.map((answer) => [answer.id, answer.verbatim_text]));
  return NextResponse.json({ interview: {
    answers: answers.map((answer) => ({ id: answer.id, question: questionById.get(answer.question_id) ?? "Interview question", verbatimText: answer.verbatim_text })),
    libraryItems: (storedItems ?? []).map((row) => voiceLibraryView(row as Record<string, unknown>, answerById.get(String(row.answer_id)) ?? "")),
  } });
}
