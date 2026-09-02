import type { SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";

type TenantScope = {
  client: SupabaseClient;
  userId: string;
  organizationId: string;
  websiteId: string;
};

async function insertedId(
  client: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  label: string,
) {
  const { data, error } = await client.from(table).insert(values).select("id").single<{ id: string }>();
  expect(error, label).toBeNull();
  expect(data?.id, label).toBeTruthy();
  return data!.id;
}

async function expectInsertRejected(client: SupabaseClient, table: string, values: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(values).select("id");
  expect(data ?? [], `${table} accepted a blended agent row.`).toHaveLength(0);
  expect(error, `${table} did not explain the rejected agent row.`).not.toBeNull();
}

export async function verifyAgentIsolation({
  owner,
  outsider,
  sameOrganizationMember,
}: {
  owner: TenantScope;
  outsider: TenantScope;
  sameOrganizationMember: TenantScope;
}) {
  const conversationId = await insertedId(owner.client, "agent_conversations", {
    organization_id: owner.organizationId,
    website_id: owner.websiteId,
    user_id: owner.userId,
    title: "Private Rebound Agent conversation",
  }, "The owner could not create an agent conversation.");
  const messageId = await insertedId(owner.client, "agent_messages", {
    organization_id: owner.organizationId,
    website_id: owner.websiteId,
    conversation_id: conversationId,
    role: "assistant",
    content: { text: "Owner-only saved evidence" },
  }, "The owner could not create an agent message.");
  const proposalId = await insertedId(owner.client, "agent_proposals", {
    organization_id: owner.organizationId,
    website_id: owner.websiteId,
    conversation_id: conversationId,
    message_id: messageId,
    payload: { title: "Private draft", targetKeyword: "private keyword" },
  }, "The owner could not create an agent proposal.");

  for (const [table, id] of [
    ["agent_conversations", conversationId],
    ["agent_messages", messageId],
    ["agent_proposals", proposalId],
  ] as const) {
    const ownRead = await owner.client.from(table).select("id").eq("id", id).maybeSingle();
    expect(ownRead.error, `${table}: owner read failed.`).toBeNull();
    expect(ownRead.data?.id, `${table}: owner record disappeared.`).toBe(id);
    for (const reader of [outsider, sameOrganizationMember]) {
      const hidden = await reader.client.from(table).select("id").eq("id", id).maybeSingle();
      expect(hidden.error, `${table}: a hidden read should return no visible row.`).toBeNull();
      expect(hidden.data, `${table}: private agent data leaked to another user.`).toBeNull();
    }
  }

  const unauthorizedDecision = await sameOrganizationMember.client.from("agent_proposals")
    .update({ status: "rejected", decided_by: sameOrganizationMember.userId, decided_at: new Date().toISOString() })
    .eq("id", proposalId).select("id");
  expect(unauthorizedDecision.data ?? [], "A same-organization member decided another user's proposal.").toHaveLength(0);

  const ownerDelete = await owner.client.from("agent_conversations").delete().eq("id", conversationId).select("id");
  expect(ownerDelete.data ?? [], "The v1 browser role unexpectedly deleted an agent conversation.").toHaveLength(0);
  expect(ownerDelete.error, "The missing v1 delete grant did not fail closed.").not.toBeNull();

  await expectInsertRejected(owner.client, "agent_conversations", {
    organization_id: owner.organizationId, website_id: outsider.websiteId,
    user_id: owner.userId, title: "Blended conversation",
  });
  await expectInsertRejected(owner.client, "agent_messages", {
    organization_id: owner.organizationId, website_id: outsider.websiteId,
    conversation_id: conversationId, role: "user", content: { text: "Must not exist" },
  });
  await expectInsertRejected(owner.client, "agent_proposals", {
    organization_id: owner.organizationId, website_id: outsider.websiteId,
    conversation_id: conversationId, message_id: messageId, payload: { title: "Must not exist" },
  });
}
