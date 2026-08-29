import type { SupabaseClient } from "@supabase/supabase-js";
import { InterviewsWorkspace, type InterviewHistoryView, type VoiceLibraryItemView } from "@/components/interviews-workspace";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { articleGenerationCapability } from "@/lib/content/article-generation";
import { buildInterviewTopicSuggestions } from "@/lib/interviews/interviews";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function InterviewsPage() {
  const context = await getWorkspaceContext();
  const capability = articleGenerationCapability(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_COPY_MODEL);
  if (!context.website) return <WorkspaceShell active="/interviews" eyebrow="Rebound SEO workspace" title="Interviews" description="Talk through what you know and turn it into content in your own voice."><WorkspaceEmpty title="Complete onboarding first" description="Add a business and website before starting an interview." /></WorkspaceShell>;

  const db = context.supabase as unknown as SupabaseClient;
  const [{ data: keywordRows }, { data: interviewRows }, { data: answerRows }, { data: libraryRows }] = await Promise.all([
    db.from("keyword_preferences").select("keyword,search_volume").eq("website_id", context.website.id).eq("decision", "approved").order("priority_score", { ascending: false }).limit(20),
    db.from("interviews").select("id,topic_title,focus_keyword,status,completed_at,created_at").eq("website_id", context.website.id).order("created_at", { ascending: false }).limit(30),
    db.from("interview_answers").select("id,interview_id,verbatim_text").eq("website_id", context.website.id).is("retracted_at", null).order("created_at", { ascending: false }).limit(300),
    db.from("voice_library_items").select("id,interview_id,answer_id,type,title,body,status").eq("website_id", context.website.id).order("updated_at", { ascending: false }).limit(100),
  ]);
  const answerCount = new Map<string, number>();
  const answerText = new Map<string, string>();
  for (const answer of answerRows ?? []) {
    const interviewId = String(answer.interview_id);
    answerCount.set(interviewId, (answerCount.get(interviewId) ?? 0) + 1);
    answerText.set(String(answer.id), String(answer.verbatim_text));
  }
  const previousInterviews: InterviewHistoryView[] = (interviewRows ?? []).map((row) => ({
    id: String(row.id),
    topicTitle: String(row.topic_title),
    focusKeyword: String(row.focus_keyword),
    status: String(row.status),
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    answerCount: answerCount.get(String(row.id)) ?? 0,
  }));
  const libraryItems: VoiceLibraryItemView[] = (libraryRows ?? []).map((row) => ({
    id: String(row.id),
    interviewId: String(row.interview_id),
    answerId: String(row.answer_id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    status: String(row.status),
    sourceText: answerText.get(String(row.answer_id)) ?? "",
  }));
  const topics = buildInterviewTopicSuggestions({
    businessName: context.website.business_name ?? "Your business",
    productsServices: context.website.products_services ?? "",
    idealCustomer: context.website.ideal_customer ?? "",
    problemSolved: context.website.problem_solved ?? "",
    differentiation: context.website.differentiation ?? "",
    approvedKeywords: (keywordRows ?? []).map((row) => ({ keyword: String(row.keyword), searchVolume: Number(row.search_volume ?? 0) })),
    previousTopics: previousInterviews.map((interview) => interview.topicTitle),
  });

  return <WorkspaceShell active="/interviews" eyebrow={context.website.normalized_domain} title="Interviews" description="Share your expertise once. Rebound SEO remembers your exact words and uses them to make future content sound more like you.">
    <InterviewsWorkspace
      websiteId={context.website.id}
      auditId={context.audit?.id ?? null}
      businessName={context.website.business_name ?? context.website.normalized_domain}
      generationAvailable={capability.available}
      topics={topics}
      previousInterviews={previousInterviews}
      libraryItems={libraryItems}
    />
  </WorkspaceShell>;
}
