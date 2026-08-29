import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVoiceContext } from "./interviews";

export type VoiceLibraryItemView = {
  id: string;
  interviewId: string;
  answerId: string;
  type: string;
  title: string;
  body: string;
  status: string;
  sourceText: string;
};

export type InterviewAnswerSource = {
  id: string;
  interview_id: string;
  question_id: string;
  verbatim_text: string;
};

type InterviewQuestionSource = {
  id: string;
  interview_id: string;
  text: string;
  kind: string;
  position: number;
};

export function websiteScopedClient(value: unknown) {
  return value as SupabaseClient;
}

export async function loadWebsiteVoiceContext(client: SupabaseClient, websiteId: string) {
  const [{ data: interviewRows }, { data: answerRows }, { data: libraryRows }] = await Promise.all([
    client.from("interviews").select("id,topic_title").eq("website_id", websiteId).eq("status", "complete").order("completed_at", { ascending: false }).limit(20),
    client.from("interview_answers").select("id,interview_id,verbatim_text").eq("website_id", websiteId).is("retracted_at", null).order("created_at", { ascending: false }).limit(24),
    client.from("voice_library_items").select("id,answer_id,type,body,status").eq("website_id", websiteId).eq("status", "confirmed_by_owner").order("updated_at", { ascending: false }).limit(20),
  ]);
  const topics = new Map((interviewRows ?? []).map((row) => [String(row.id), String(row.topic_title)]));
  return buildVoiceContext({
    answers: (answerRows ?? []).map((row) => ({
      id: String(row.id),
      verbatimText: String(row.verbatim_text),
      interviewTopic: topics.get(String(row.interview_id)) ?? "Rebound SEO interview",
    })),
    libraryItems: (libraryRows ?? []).map((row) => ({
      id: String(row.id),
      type: String(row.type),
      body: String(row.body),
      status: String(row.status),
      answerId: String(row.answer_id),
    })),
  });
}

export function buildLibraryRows({
  organizationId,
  websiteId,
  interviewId,
  questions,
  answers,
}: {
  organizationId: string;
  websiteId: string;
  interviewId: string;
  questions: InterviewQuestionSource[];
  answers: InterviewAnswerSource[];
}) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const labels: Record<string, { type: string; title: string }> = {
    warm_up: { type: "theme", title: "What customers should understand first" },
    contrarian: { type: "pov", title: "A point of view worth preserving" },
    story: { type: "story", title: "A firsthand customer story" },
    change: { type: "pov", title: "What experience changed their mind about" },
    evidence: { type: "evidence", title: "Evidence from their own experience" },
    product_tie_in: { type: "product_note", title: "How their approach is different" },
    audience_advice: { type: "audience_pain", title: "The advice customers should remember" },
  };
  return answers.flatMap((answer) => {
    const question = questionById.get(answer.question_id);
    if (!question || !answer.verbatim_text.trim()) return [];
    const label = labels[question.kind] ?? { type: "theme", title: "Expert perspective" };
    return [{
      organization_id: organizationId,
      website_id: websiteId,
      interview_id: interviewId,
      answer_id: answer.id,
      type: label.type,
      title: label.title,
      body: answer.verbatim_text.trim().slice(0, 4000),
      provenance: [{ answer_id: answer.id, char_start: 0, char_end: answer.verbatim_text.trim().length }],
      status: "suggested",
    }];
  });
}

export function voiceLibraryView(row: Record<string, unknown>, sourceText: string): VoiceLibraryItemView {
  return {
    id: String(row.id),
    interviewId: String(row.interview_id),
    answerId: String(row.answer_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    status: String(row.status),
    sourceText,
  };
}
