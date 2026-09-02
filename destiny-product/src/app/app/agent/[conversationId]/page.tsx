import { redirect } from "next/navigation";
import { AgentShell } from "@/components/agent/agent-shell";
import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { loadAgentWorkspace } from "@/lib/agent/store";

export const dynamic = "force-dynamic";

export default async function ReboundAgentConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const view = await loadAgentWorkspace(conversationId);
  if (!view) redirect("/onboarding");
  return <AgentShell website={view.website}>
    <AgentWorkspace
      conversations={view.conversations}
      initialMessages={view.messages}
      initialProposals={view.proposals}
      selectedConversationId={view.selectedConversationId}
      suggestedPrompts={view.suggestedPrompts}
      website={view.website}
    />
  </AgentShell>;
}
