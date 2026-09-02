import { callAnthropic } from "./provider";
import { buildAgentSystemPrompt } from "./prompt";
import { AGENT_TOOL_DEFINITIONS, runAgentTool } from "./tools/registry";
import type {
  AgentEvent,
  AgentHistoryMessage,
  AgentToolContext,
  DraftProposal,
  ProviderResult,
} from "./types";

type Provider = (input: {
  apiKey: string;
  model: string;
  messages: AgentHistoryMessage[];
  system: string;
  tools: typeof AGENT_TOOL_DEFINITIONS;
  signal?: AbortSignal;
}) => Promise<ProviderResult>;

function boundedJson(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized.length <= 12_000) return serialized;
  return JSON.stringify({ truncated: true, preview: serialized.slice(0, 11_500) });
}

export async function runAgentLoop({
  context,
  history,
  apiKey = "",
  model = "",
  provider = callAnthropic,
  onEvent,
  signal,
}: {
  context: AgentToolContext;
  history: AgentHistoryMessage[];
  apiKey?: string;
  model?: string;
  provider?: Provider;
  onEvent: (event: AgentEvent) => void | Promise<void>;
  signal?: AbortSignal;
}) {
  const messages = history.slice(-24);
  const proposals: DraftProposal[] = [];
  let toolRuns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  await onEvent({ type: "status", message: "Reading saved SEO evidence" });

  for (let call = 0; call < 6; call += 1) {
    const result = await provider({
      apiKey,
      model,
      messages,
      system: buildAgentSystemPrompt({ businessName: context.businessName, domain: context.domain }),
      tools: AGENT_TOOL_DEFINITIONS,
      signal,
    });
    inputTokens += result.usage.inputTokens;
    outputTokens += result.usage.outputTokens;
    const toolUses = result.blocks.filter((block) => block.type === "tool_use");
    if (!toolUses.length) {
      const text = result.text || "I could not produce a grounded answer from the saved evidence yet.";
      await onEvent({ type: "text", text });
      await onEvent({ type: "done" });
      return { text, proposals, usage: { inputTokens, outputTokens } };
    }

    messages.push({ role: "assistant", content: result.blocks });
    const toolResults: Array<Record<string, unknown>> = [];
    for (const toolUse of toolUses) {
      if (toolRuns >= 10) throw new Error("This turn reached the safe tool limit.");
      toolRuns += 1;
      await onEvent({ type: "tool_start", name: toolUse.name });
      const toolResult = await runAgentTool(toolUse.name, toolUse.input, context);
      await onEvent({ type: "tool_end", name: toolUse.name, summary: toolResult.summary });
      if (toolUse.name === "propose_draft" && toolResult.ok && toolResult.data) {
        const proposal = toolResult.data as DraftProposal;
        proposals.push(proposal);
        await onEvent({ type: "proposal", proposal });
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: "<untrusted_tool_evidence>\n" + boundedJson(toolResult) + "\n</untrusted_tool_evidence>",
        is_error: !toolResult.ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }
  throw new Error("This turn reached the safe model-call limit.");
}
