import "server-only";

import { scopedClient } from "@/lib/db";
import { getWorkspaceContext, record } from "@/lib/workspace-context";
import { buildCoachTaskSet } from "@/lib/product/coach-experience";
import { buildCoreQueue } from "@/lib/rebound-core/queue";
import { empty, ready } from "@/lib/rebound-core/panel-result";
import type { DraftProposalInput } from "./types";
import { validateDraftProposal } from "./validate";

function messageText(content: unknown) {
  const value = record(content);
  return typeof value.text === "string" ? value.text : "";
}

export async function loadAgentWorkspace(conversationId?: string) {
  const context = await getWorkspaceContext();
  if (!context.website) return null;
  const client = await scopedClient(context.website.id);
  const coach = await buildCoachTaskSet(context.quests);
  const builtQueue = buildCoreQueue(coach.window.map((quest, index) => ({
    id: quest.id,
    title: quest.title,
    description: quest.description,
    actionPath: quest.action_path,
    taskType: quest.task_type,
    priority: index,
    status: quest.status,
    verificationStatus: quest.verification_status,
  })));
  const websiteLabel = context.website.business_name?.trim() || context.website.normalized_domain;
  const firstMove = builtQueue.items[0];
  const searchConnected = context.integrations.some((item) => item.provider === "google_search_console" && item.status === "connected");
  const { data: conversations } = await client.select("agent_conversations", "id,title,updated_at")
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  const selectedId = conversationId && conversations?.some((item) => item.id === conversationId)
    ? conversationId
    : null;
  const [{ data: messages }, { data: proposals }] = selectedId
    ? await Promise.all([
        client.select("agent_messages", "id,role,content,created_at")
          .eq("conversation_id", selectedId).order("created_at").limit(100),
        client.select("agent_proposals", "id,status,payload,result,artifact_id,created_at")
          .eq("conversation_id", selectedId).order("created_at").limit(50),
      ])
    : [{ data: [] }, { data: [] }];
  return {
    website: {
      id: context.website.id,
      label: websiteLabel,
      domain: context.website.normalized_domain,
    },
    shell: {
      queue: builtQueue.items.length
        ? ready(builtQueue)
        : empty("Nothing needs you right now. Rebound SEO is watching for the next move."),
      websiteId: context.website.id,
      websiteLabel,
      websites: context.websites.map((website) => ({
        id: website.id,
        business_name: website.business_name,
        normalized_domain: website.normalized_domain,
      })),
      searchConnected,
    },
    suggestedPrompts: [
      ...(firstMove ? [`Help me complete the saved move: ${firstMove.title}`] : []),
      ...(searchConnected ? [`What changed in the saved Search Console data for ${websiteLabel}?`] : []),
      `Summarize the saved SEO progress for ${websiteLabel}.`,
    ].slice(0, 3),
    conversations: (conversations ?? []).map((item) => ({
      id: String(item.id),
      title: String(item.title),
      updatedAt: String(item.updated_at),
    })),
    selectedConversationId: selectedId,
    messages: (messages ?? []).map((item) => {
      const content = record(item.content);
      return {
        id: String(item.id),
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        text: messageText(content),
        work: Array.isArray(content.work) ? content.work.filter((value): value is string => typeof value === "string") : undefined,
      };
    }),
    proposals: (proposals ?? []).flatMap((item) => {
      const payload = record(item.payload);
      if (typeof payload.title !== "string" || typeof payload.targetKeyword !== "string") return [];
      return [{
        id: String(item.id),
        status: item.status as "proposed" | "approved" | "rejected" | "failed",
        title: payload.title,
        targetKeyword: payload.targetKeyword,
        angle: typeof payload.angle === "string" ? payload.angle : "",
        outlineBullets: Array.isArray(payload.outlineBullets)
          ? payload.outlineBullets.filter((value): value is string => typeof value === "string")
          : [],
        href: item.status === "approved" && item.artifact_id
          ? `/app/content/${String(item.artifact_id)}?site=${context.website.id}`
          : undefined,
      }];
    }),
  };
}

export async function loadRequestScope(
  client: Awaited<ReturnType<typeof scopedClient>>,
  userId: string,
  websiteId: string,
) {
  const { data, error } = await client.website("id,organization_id,business_name,normalized_domain").maybeSingle();
  if (error || !data) return null;
  return {
    client,
    userId,
    websiteId,
    organizationId: String(data.organization_id),
    businessName: String(data.business_name || data.normalized_domain),
    domain: String(data.normalized_domain),
  };
}

export async function ensureConversation(
  scope: NonNullable<Awaited<ReturnType<typeof loadRequestScope>>>,
  conversationId: string | null,
  firstMessage: string,
) {
  if (!scope) throw new Error("Website scope is unavailable.");
  if (conversationId) {
    const { data } = await scope.client.select("agent_conversations", "id")
      .eq("id", conversationId).eq("user_id", scope.userId).maybeSingle();
    if (!data) throw new Error("Conversation not found.");
    return conversationId;
  }
  const title = firstMessage.replace(/\s+/g, " ").slice(0, 72);
  const { data, error } = await scope.client.insert("agent_conversations", {
    organization_id: scope.organizationId,
    website_id: scope.websiteId,
    user_id: scope.userId,
    title,
  }).select("id").single();
  if (error || !data) throw new Error("Conversation could not be created.");
  return String(data.id);
}

export async function insertUserMessage(
  scope: NonNullable<Awaited<ReturnType<typeof loadRequestScope>>>,
  conversationId: string,
  text: string,
) {
  const { error } = await scope.client.insert("agent_messages", {
    organization_id: scope.organizationId,
    website_id: scope.websiteId,
    conversation_id: conversationId,
    role: "user",
    content: { text },
  });
  if (error) throw new Error("Message could not be saved.");
}

export async function loadProviderHistory(
  scope: NonNullable<Awaited<ReturnType<typeof loadRequestScope>>>,
  conversationId: string,
) {
  const { data, error } = await scope.client.select("agent_messages", "role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(24);
  if (error) throw new Error("Conversation history could not be loaded.");
  return [...(data ?? [])].reverse().map((item) => ({
    role: item.role === "assistant" ? "assistant" as const : "user" as const,
    content: messageText(item.content),
  }));
}

export async function persistAssistantTurn({
  scope,
  conversationId,
  text,
  work,
  inputTokens,
  outputTokens,
  proposals,
}: {
  scope: NonNullable<Awaited<ReturnType<typeof loadRequestScope>>>;
  conversationId: string;
  text: string;
  work: string[];
  inputTokens: number;
  outputTokens: number;
  proposals: DraftProposalInput[];
}) {
  const safeProposals = proposals.map((proposal) => {
    const validated = validateDraftProposal(proposal);
    if (!validated.ok) throw new Error("The draft proposal failed persistence validation.");
    return validated.value;
  });
  const { data: message, error } = await scope.client.insert("agent_messages", {
    organization_id: scope.organizationId,
    website_id: scope.websiteId,
    conversation_id: conversationId,
    role: "assistant",
    content: { text, work },
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  }).select("id").single();
  if (error || !message) throw new Error("Assistant response could not be saved.");
  const rows = safeProposals.map((payload) => ({
    organization_id: scope.organizationId,
    website_id: scope.websiteId,
    conversation_id: conversationId,
    message_id: message.id,
    kind: "draft",
    payload,
  }));
  let saved: Array<Record<string, unknown>> = [];
  if (rows.length) {
    const result = await scope.client.insert("agent_proposals", rows).select("id,status,payload");
    if (result.error) throw new Error("Draft proposal could not be saved.");
    saved = result.data ?? [];
  }
  await scope.client.update("agent_conversations", { updated_at: new Date().toISOString() }, { id: conversationId });
  return saved;
}
