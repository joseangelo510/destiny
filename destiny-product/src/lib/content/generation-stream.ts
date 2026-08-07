export type ArticleGenerationPhase = "researching" | "writing";

export type ArticleGenerationStreamEvent<T> =
  | { type: "phase"; phase: ArticleGenerationPhase }
  | { type: "keepalive" }
  | { type: "result"; payload: T };

export function encodeArticleGenerationEvent<T>(event: ArticleGenerationStreamEvent<T>) {
  return `${JSON.stringify(event)}\n`;
}

export async function readArticleGenerationStream<T>(
  body: ReadableStream<Uint8Array> | null,
  onPhase: (phase: ArticleGenerationPhase) => void,
): Promise<T> {
  if (!body) throw new Error("Destiny did not receive a generation response.");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;

  const readLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ArticleGenerationStreamEvent<T>;
    if (event.type === "phase") onPhase(event.phase);
    if (event.type === "result") result = event.payload;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) readLine(line);
    if (done) break;
  }

  if (buffer.trim()) readLine(buffer);
  if (result === undefined) throw new Error("Destiny did not receive a completed generation result.");
  return result;
}
