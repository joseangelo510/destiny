export type AgentRole = "user" | "assistant";

export type AgentHistoryMessage = {
  role: AgentRole;
  content: unknown;
};

export type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type ProviderResult = {
  blocks: AnthropicBlock[];
  text: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
};

export type DraftProposalInput = {
  title: string;
  targetKeyword: string;
  angle: string;
  outlineBullets: string[];
};

export type DraftProposal = DraftProposalInput & {
  id?: string;
  status: "proposed" | "approved" | "rejected" | "failed";
};

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_end"; name: string; summary: string }
  | { type: "text"; text: string }
  | { type: "proposal"; proposal: DraftProposal }
  | { type: "done"; conversationId?: string }
  | { type: "error"; message: string };

export type ToolQueryResult = { summary: string; data: unknown };

export type AgentToolContext = {
  userId: string;
  organizationId: string;
  websiteId: string;
  businessName: string;
  domain: string;
  query: (
    name: string,
    input: Record<string, unknown>,
    scope: { userId: string; organizationId: string; websiteId: string },
  ) => Promise<ToolQueryResult>;
};
