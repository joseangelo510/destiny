import type { AgentHistoryMessage, AnthropicBlock, ProviderResult } from "./types";

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicPayload = {
  content?: unknown;
  stop_reason?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
  error?: { message?: unknown };
};

function parseBlocks(value: unknown): AnthropicBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: AnthropicBlock[] = [];
  for (const block of value) {
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const item = block as Record<string, unknown>;
    if (item.type === "text" && typeof item.text === "string") {
      blocks.push({ type: "text", text: item.text });
      continue;
    }
    if (item.type === "tool_use" && typeof item.id === "string" && typeof item.name === "string") {
      blocks.push({ type: "tool_use", id: item.id, name: item.name, input: item.input });
    }
  }
  return blocks;
}

export async function callAnthropic({
  apiKey,
  model,
  messages,
  system,
  tools,
  signal,
  fetchImpl = fetch,
}: {
  apiKey: string;
  model: string;
  messages: AgentHistoryMessage[];
  system: string;
  tools: ToolDefinition[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<ProviderResult> {
  const requestBody = { model, max_tokens: 2_048, system, messages, tools };
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeout = AbortSignal.timeout(40_000);
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    lastStatus = response.status;
    const payload = await response.json().catch(() => ({})) as AnthropicPayload;
    if (response.ok) {
      const blocks = parseBlocks(payload.content);
      return {
        blocks,
        text: blocks.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n").trim(),
        stopReason: typeof payload.stop_reason === "string" ? payload.stop_reason : null,
        usage: {
          inputTokens: Number(payload.usage?.input_tokens) || 0,
          outputTokens: Number(payload.usage?.output_tokens) || 0,
        },
      };
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) {
      const message = typeof payload.error?.message === "string" ? payload.error.message : "Anthropic request failed.";
      throw new Error(message);
    }
  }
  throw new Error("Anthropic request failed with HTTP " + lastStatus + ".");
}
