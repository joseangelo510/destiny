import { describe, expect, it } from "vitest";
import { buildCoreQueue, type QueueInput } from "./queue";

const input = (id: string, priority: number, overrides: Partial<QueueInput> = {}): QueueInput => ({
  id,
  title: `Move ${id}`,
  description: `Description ${id}`,
  actionPath: `/tool/${id}`,
  taskType: "primary_quest",
  priority,
  status: "open",
  ...overrides,
});

describe("buildCoreQueue", () => {
  it("uses the same object for queue item one and session move one", () => {
    const queue = buildCoreQueue([input("third", 3), input("first", 1), input("second", 2)]);
    expect(queue.items[0]).toBe(queue.sessionMoves[0]);
    expect(queue.items[0].id).toBe("first");
  });

  it("keeps ordering stable with id as the final tie-breaker", () => {
    expect(buildCoreQueue([input("b", 1), input("a", 1)]).items.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("omits complete and skipped work and returns a calm empty session", () => {
    const queue = buildCoreQueue([input("done", 1, { status: "complete" }), input("skip", 2, { status: "skipped" })]);
    expect(queue).toEqual({ items: [], sessionMoves: [] });
  });
});
