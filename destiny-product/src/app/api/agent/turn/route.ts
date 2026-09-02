import { NextResponse } from "next/server";
import { DEFAULT_COPY_MODEL } from "@/lib/content/article-generation";
import { runAgentLoop } from "@/lib/agent/loop";
import { allowAgentTurn } from "@/lib/agent/rate-limit";
import {
  ensureConversation,
  insertUserMessage,
  loadProviderHistory,
  loadRequestScope,
  persistAssistantTurn,
} from "@/lib/agent/store";
import { createAgentToolQuery } from "@/lib/agent/tools/data-query";
import type { AgentEvent, DraftProposal } from "@/lib/agent/types";
import { validateTurnInput } from "@/lib/agent/validate";
import { scopedClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function eventChunk(event: AgentEvent) {
  return "event: " + event.type + "\ndata: " + JSON.stringify(event) + "\n\n";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validated = validateTurnInput(body);
  if (!validated.ok) return responseError(validated.errors.join(" "), 400);

  const client = await scopedClient(validated.value.websiteId);
  const userId = await client.getClaims();
  if (!userId) return responseError("Sign in again to use Rebound Agent.", 401);

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return responseError("Rebound Agent is not configured yet.", 503);
  const limit = allowAgentTurn({ userId, websiteId: validated.value.websiteId });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Rebound Agent has reached its hourly safety limit.", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const scope = await loadRequestScope(client, userId, validated.value.websiteId);
  if (!scope) return responseError("The selected website is not available to this account.", 404);
  let conversationId: string;
  try {
    conversationId = await ensureConversation(scope, validated.value.conversationId, validated.value.message);
    await insertUserMessage(scope, conversationId, validated.value.message);
  } catch (cause) {
    return responseError(cause instanceof Error ? cause.message : "The conversation could not be opened.", 404);
  }
  const history = await loadProviderHistory(scope, conversationId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(eventChunk(event)));
      void (async () => {
        const work: string[] = [];
        try {
          const result = await runAgentLoop({
            apiKey,
            model: process.env.ANTHROPIC_COPY_MODEL?.trim() || DEFAULT_COPY_MODEL,
            context: {
              userId,
              organizationId: scope.organizationId,
              websiteId: scope.websiteId,
              businessName: scope.businessName,
              domain: scope.domain,
              query: createAgentToolQuery(),
            },
            history,
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
            onEvent(event) {
              if (event.type === "tool_end") work.push(event.summary);
              if (event.type !== "proposal" && event.type !== "done") send(event);
            },
          });
          const saved = await persistAssistantTurn({
            scope,
            conversationId,
            text: result.text,
            work,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            proposals: result.proposals,
          });
          for (const item of saved) {
            const payload = record(item.payload);
            send({
              type: "proposal",
              proposal: {
                id: String(item.id),
                status: "proposed",
                title: String(payload.title ?? ""),
                targetKeyword: String(payload.targetKeyword ?? ""),
                angle: String(payload.angle ?? ""),
                outlineBullets: Array.isArray(payload.outlineBullets)
                  ? payload.outlineBullets.filter((value): value is string => typeof value === "string")
                  : [],
              } satisfies DraftProposal,
            });
          }
          send({ type: "done", conversationId });
        } catch (cause) {
          send({ type: "error", message: cause instanceof Error ? cause.message : "Rebound Agent could not finish this turn." });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
