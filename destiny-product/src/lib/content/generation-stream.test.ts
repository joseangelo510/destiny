import { describe, expect, it } from "vitest";
import { encodeArticleGenerationEvent, readArticleGenerationStream } from "./generation-stream";

const encoder = new TextEncoder();

describe("article generation stream", () => {
  it("keeps lifecycle events separate from the final result across split chunks", async () => {
    const source = [
      encodeArticleGenerationEvent({ type: "phase", phase: "researching" }),
      encodeArticleGenerationEvent({ type: "keepalive" }),
      encodeArticleGenerationEvent({ type: "phase", phase: "writing" }),
      encodeArticleGenerationEvent({ type: "phase", phase: "finishing" }),
      encodeArticleGenerationEvent({ type: "result", payload: { draft: { title: "Complete" } } }),
    ].join("");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(source.slice(0, 31)));
        controller.enqueue(encoder.encode(source.slice(31)));
        controller.close();
      },
    });
    const phases: string[] = [];

    await expect(readArticleGenerationStream(body, (phase) => phases.push(phase))).resolves.toEqual({ draft: { title: "Complete" } });
    expect(phases).toEqual(["researching", "writing", "finishing"]);
  });

  it("fails closed when the stream ends without a final result", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(encodeArticleGenerationEvent({ type: "phase", phase: "writing" })));
        controller.close();
      },
    });

    await expect(readArticleGenerationStream(body, () => undefined)).rejects.toThrow("completed generation result");
  });
});
