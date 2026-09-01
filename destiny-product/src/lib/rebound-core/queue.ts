import type { CoreMove, CoreQueue } from "./contracts";
import { reboundCustomerText } from "./brand";

export type QueueInput = {
  id: string;
  title: string | null;
  description: string | null;
  actionPath: string;
  taskType: string;
  priority: number;
  status: string;
  verificationStatus?: string | null;
};

function stateFor(input: QueueInput): CoreMove["state"] {
  if (input.verificationStatus === "verified") return "ready";
  if (input.status === "complete") return "reported";
  if (input.taskType === "content_review") return "draft";
  return "open";
}

function whyFor(input: QueueInput) {
  if (input.taskType === "content_review") return "Keeps content moving";
  if (input.taskType.includes("distribution")) return "Extends published work";
  if (input.taskType === "keyword_review") return "Sharpens the strategy";
  if (input.taskType.includes("technical") || input.taskType === "primary_quest") return "Removes a search blocker";
  return "Moves the plan forward";
}

export function buildCoreQueue(inputs: QueueInput[], sessionLimit = 3): CoreQueue {
  const items = inputs
    .filter((input) => input.status !== "complete" && input.status !== "skipped")
    .map((input) => ({
      id: input.id,
      title: reboundCustomerText(input.title?.trim() || "Open the next recommended move"),
      description: reboundCustomerText(input.description?.trim() || "Rebound SEO has the details ready in the current tool."),
      href: input.actionPath.startsWith("/") ? input.actionPath : "/this-week",
      why: whyFor(input),
      estimateMinutes: null,
      state: stateFor(input),
      priority: input.priority,
    }))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      href: item.href,
      why: item.why,
      estimateMinutes: item.estimateMinutes,
      state: item.state,
    }));
  return { items, sessionMoves: items.slice(0, Math.max(0, sessionLimit)) };
}
