import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";
import { voiceLibraryView } from "@/lib/interviews/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const websiteId = new URL(request.url).searchParams.get("websiteId") ?? "";
  if (!UUID.test(id) || !UUID.test(websiteId)) return NextResponse.json({ error: "Choose a valid website and interview." }, { status: 400 });
  const db = await scopedClient(websiteId);
  const userId = await db.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to reopen the interview." }, { status: 401 });
  const { data: interview, error } = await db.select("interviews", "id,created_by,topic_title,focus_keyword,status")
    .eq("id", id).eq("created_by", userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Rebound SEO could not load this interview." }, { status: 500 });
  if (!interview || !["in_progress", "complete"].includes(String(interview.status))) return NextResponse.json({ error: "That interview is not available for this website." }, { status: 404 });
  const [questionsResult, answersResult, libraryResult] = await Promise.all([
    db.select("interview_questions", "id,position,kind,text,skipped").eq("interview_id", id).order("position"),
    db.select("interview_answers", "id,question_id,verbatim_text,retracted_at").eq("interview_id", id).order("created_at"),
    db.select("voice_library_items", "id,interview_id,answer_id,type,title,body,status").eq("interview_id", id).order("created_at"),
  ]);
  if ([questionsResult, answersResult, libraryResult].some(result => result.error)) return NextResponse.json({ error: "Your interview is saved, but Rebound SEO could not load every part. Try again." }, { status: 500 });
  const answers = (answersResult.data ?? []).filter(row => !row.retracted_at);
  const answered = new Set(answers.map(row => String(row.question_id)));
  const questions = (questionsResult.data ?? []).map(row => ({ id: String(row.id), position: Number(row.position), kind: String(row.kind), text: String(row.text), skipped: row.skipped === true, answered: answered.has(String(row.id)) }));
  if (!questions.length) return NextResponse.json({ error: "The saved interview questions are unavailable." }, { status: 409 });
  const questionById = new Map(questions.map(question => [question.id, question.text]));
  const answerById = new Map(answers.map(answer => [String(answer.id), String(answer.verbatim_text)]));
  return NextResponse.json({ interview: {
    id: String(interview.id), topicTitle: String(interview.topic_title), focusKeyword: String(interview.focus_keyword), status: String(interview.status), questions,
    nextQuestionIndex: questions.findIndex(question => !question.answered && !question.skipped),
    answers: answers.map(answer => ({ id: String(answer.id), question: questionById.get(String(answer.question_id)) ?? "Interview question", verbatimText: String(answer.verbatim_text) })),
    libraryItems: (libraryResult.data ?? []).map(row => voiceLibraryView(row, answerById.get(String(row.answer_id)) ?? "")),
  } }, { headers: { "Cache-Control": "no-store" } });
}
