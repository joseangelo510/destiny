import { LlmSourceDashboard } from "@/components/llm-source-dashboard";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, providerResultFromMetrics, record } from "@/lib/workspace-context";
import { buildLlmSourceProgress } from "@/lib/llm/source-progress";

export default async function LlmVisibilityPage() {
  const context = await getWorkspaceContext();
  const provider = providerResultFromMetrics(context.metrics);
  const llm = record(provider.llmVisibility);
  const platforms = list(llm.platforms).map(record);

  if (!context.website) {
    return <WorkspaceShell active="/llm-visibility" eyebrow="Destiny workspace" title="LLM visibility" description="Build source readiness, then verify company mentions and citations with provider evidence.">
      <WorkspaceEmpty title="Complete onboarding to build your AI visibility map" description="Destiny needs a business website before it can save source-specific actions and monitor available visibility evidence." />
    </WorkspaceShell>;
  }

  const { data: sourceTasks } = await context.supabase
    .from("llm_visibility_tasks")
    .select("id,source_key,task_key,status,completed_at,proof_url,proof_attached_at,updated_at")
    .eq("website_id", context.website.id)
    .order("updated_at", { ascending: true });
  const initialRecords = (sourceTasks ?? []).map((task) => ({
    id: task.id, source_key: task.source_key, task_key: task.task_key, status: task.status,
    completed_at: task.completed_at, proof_url: task.proof_url, proof_attached_at: task.proof_attached_at, updated_at: task.updated_at,
  }));
  const llmVisibility = { status: llm.status, totalMentions: llm.totalMentions, platforms: platforms.map((platform) => ({ platform: platform.platform, mentions: platform.mentions })) };
  const initialProgress = await buildLlmSourceProgress({ records: initialRecords, llmVisibility });
  return <WorkspaceShell active="/llm-visibility" eyebrow={context.website.normalized_domain} hideHeader title="AI visibility playboard" description="Ghost bars show how often AI cites each source. Your color shows your readiness.">
    <LlmSourceDashboard
      initialRecords={initialRecords}
      initialProgress={initialProgress}
      llmVisibility={llmVisibility}
      websiteId={context.website.id}
    />
  </WorkspaceShell>;
}
