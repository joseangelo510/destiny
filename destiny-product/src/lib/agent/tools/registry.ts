import { validateDraftProposal } from "../validate";
import type { AgentToolContext, DraftProposal } from "../types";

export const AGENT_TOOL_NAMES = [
  "get_website_context",
  "get_search_console_summary",
  "get_search_console_queries",
  "get_search_console_pages",
  "get_keyword_verdicts",
  "list_drafts",
  "get_draft",
  "get_calendar",
  "get_distribution_status",
  "get_progress_summary",
  "get_evidence",
  "propose_draft",
] as const;

export type AgentToolName = typeof AGENT_TOOL_NAMES[number];

const descriptions: Record<AgentToolName, string> = {
  get_website_context: "Load the selected website identity, current audit, and connection state.",
  get_search_console_summary: "Load saved Search Console headline metrics for 7, 28, or 90 days.",
  get_search_console_queries: "Load saved Search Console queries ordered by clicks, impressions, or position change.",
  get_search_console_pages: "Load saved Search Console pages ordered by clicks, impressions, or position change.",
  get_keyword_verdicts: "Load saved keyword strategy decisions and evidence.",
  list_drafts: "List saved article drafts and their current states.",
  get_draft: "Load one saved draft with at most 6,000 characters of body context.",
  get_calendar: "Load saved publishing schedule items in a date range.",
  get_distribution_status: "Load current distribution and interlink status.",
  get_progress_summary: "Load open and completed work plus tracked keyword counts.",
  get_evidence: "Load bounded saved evidence related to a topic.",
  propose_draft: "Propose one draft permission card. This does not create or publish anything.",
};

const schemas: Record<AgentToolName, Record<string, unknown>> = Object.fromEntries(
  AGENT_TOOL_NAMES.map((name) => [name, { type: "object", properties: {}, additionalProperties: false }]),
) as unknown as Record<AgentToolName, Record<string, unknown>>;

schemas.get_search_console_summary = {
  type: "object",
  properties: { days: { type: "integer", enum: [7, 28, 90] } },
  required: ["days"],
  additionalProperties: false,
};
for (const name of ["get_search_console_queries", "get_search_console_pages"] as const) {
  schemas[name] = {
    type: "object",
    properties: {
      days: { type: "integer", enum: [7, 28, 90] },
      sort: { type: "string", enum: ["clicks", "impressions", "position_change"] },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: ["days", "sort", "limit"],
    additionalProperties: false,
  };
}
schemas.get_keyword_verdicts = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["approved", "declined"] },
    limit: { type: "integer", minimum: 1, maximum: 50 },
  },
  additionalProperties: false,
};
schemas.list_drafts = {
  type: "object",
  properties: { status: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 25 } },
  additionalProperties: false,
};
schemas.get_draft = {
  type: "object",
  properties: { draftId: { type: "string", format: "uuid" } },
  required: ["draftId"],
  additionalProperties: false,
};
schemas.get_calendar = {
  type: "object",
  properties: { from: { type: "string" }, to: { type: "string" } },
  required: ["from", "to"],
  additionalProperties: false,
};
schemas.get_evidence = {
  type: "object",
  properties: { topic: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } },
  required: ["topic"],
  additionalProperties: false,
};
schemas.propose_draft = {
  type: "object",
  properties: {
    title: { type: "string" },
    targetKeyword: { type: "string" },
    angle: { type: "string" },
    outlineBullets: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 12 },
  },
  required: ["title", "targetKeyword", "angle", "outlineBullets"],
  additionalProperties: false,
};

export const AGENT_TOOL_DEFINITIONS = AGENT_TOOL_NAMES.map((name) => ({
  name,
  description: descriptions[name],
  input_schema: schemas[name],
}));

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedInput(name: AgentToolName, value: unknown) {
  const input = object(value);
  if (name === "get_search_console_summary") {
    return { days: [7, 28, 90].includes(Number(input.days)) ? Number(input.days) : 28 };
  }
  if (name === "get_search_console_queries" || name === "get_search_console_pages") {
    const allowedSort = new Set(["clicks", "impressions", "position_change"]);
    return {
      days: [7, 28, 90].includes(Number(input.days)) ? Number(input.days) : 28,
      sort: allowedSort.has(String(input.sort)) ? String(input.sort) : "clicks",
      limit: Math.min(50, Math.max(1, Number(input.limit) || 20)),
    };
  }
  if (name === "get_keyword_verdicts") {
    const verdict = new Set(["approved", "declined"]).has(String(input.verdict))
      ? String(input.verdict)
      : undefined;
    return { ...(verdict ? { verdict } : {}), limit: Math.min(50, Math.max(1, Number(input.limit) || 20)) };
  }
  if (name === "list_drafts") {
    return {
      ...(typeof input.status === "string" ? { status: input.status.slice(0, 40) } : {}),
      limit: Math.min(25, Math.max(1, Number(input.limit) || 15)),
    };
  }
  if (name === "get_draft") return { draftId: String(input.draftId ?? "") };
  if (name === "get_calendar") return { from: String(input.from ?? ""), to: String(input.to ?? "") };
  if (name === "get_evidence") {
    return { topic: String(input.topic ?? "").slice(0, 300), limit: Math.min(20, Math.max(1, Number(input.limit) || 10)) };
  }
  return {};
}

export async function runAgentTool(name: string, input: unknown, context: AgentToolContext) {
  if (!AGENT_TOOL_NAMES.includes(name as AgentToolName)) {
    return { ok: false, summary: "That tool is not available.", data: null, fetchedAt: new Date().toISOString() };
  }
  if (name === "propose_draft") {
    const validated = validateDraftProposal(input);
    if (!validated.ok) {
      return { ok: false, summary: validated.errors.join(" "), data: null, fetchedAt: new Date().toISOString() };
    }
    const proposal: DraftProposal = { ...validated.value, status: "proposed" };
    return { ok: true, summary: "Draft proposal ready for approval.", data: proposal, fetchedAt: new Date().toISOString() };
  }
  const toolName = name as AgentToolName;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      context.query(toolName, boundedInput(toolName, input), {
        userId: context.userId,
        organizationId: context.organizationId,
        websiteId: context.websiteId,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Agent tool timed out.")), 10_000);
      }),
    ]);
    return { ok: true, summary: result.summary.slice(0, 500), data: result.data, fetchedAt: new Date().toISOString() };
  } catch {
    return { ok: false, summary: "Saved evidence could not be loaded for this tool.", data: null, fetchedAt: new Date().toISOString() };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
