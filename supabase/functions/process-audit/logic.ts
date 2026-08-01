import { COMPILED_LOGOS_WASM_BASE64 } from "./wasm.ts";

export type DestinyLogicInput = {
  auditComplete: number;
  criticalIssues: number;
  rankingKeywords: number;
  contentGaps: number;
  reviewCount: number;
};

export type DestinyLogicResult = {
  growthStage: string;
  weeklyQuest: string;
};

type LogicExports = {
  memory: WebAssembly.Memory;
  main: () => void;
};

// Compiled from destiny-logic-engine/src/main.lg with LOGICAFFEINE v0.10.1.
// Keeping the small module beside the worker guarantees that the saved quest is
// chosen by the same deterministic rules as the browser preview.
function decodeWasm() {
  const binary = atob(COMPILED_LOGOS_WASM_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function runDestinyLogic(input: DestinyLogicInput): Promise<DestinyLogicResult> {
  const output: string[] = [];
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const runtimeRef: { current?: LogicExports } = {};
  let argumentHandle = 0;

  const dataView = () => {
    if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");
    return new DataView(runtimeRef.current.memory.buffer);
  };
  const bytesView = () => {
    if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");
    return new Uint8Array(runtimeRef.current.memory.buffer);
  };
  const readText = (handle: number) => {
    const view = dataView();
    const length = view.getInt32(handle, true);
    const pointer = view.getInt32(handle + 8, true);
    return decoder.decode(bytesView().subarray(pointer, pointer + length));
  };

  const argv = [
    "destiny-logic-engine",
    String(input.auditComplete),
    String(input.criticalIssues),
    String(input.rankingKeywords),
    String(input.contentGaps),
    String(input.reviewCount),
  ];

  const imports = {
    env: {
      print_text: (handle: number) => output.push(readText(handle)),
      parse_int: (handle: number) => BigInt(Number.parseInt(readText(handle).trim(), 10) || 0),
      args: () => {
        if (argumentHandle) return argumentHandle;
        if (!runtimeRef.current) throw new Error("LOGOS runtime is not ready.");

        const sequence = runtimeRef.current.memory.grow(1) * 65_536;
        const view = dataView();
        const memory = bytesView();
        const sequenceData = sequence + 16;
        let pointer = sequenceData + argv.length * 8;
        const textHandles: number[] = [];

        for (const value of argv) {
          const textHandle = pointer;
          const encoded = encoder.encode(value);
          const textData = textHandle + 16;
          view.setInt32(textHandle, encoded.length, true);
          view.setInt32(textHandle + 4, encoded.length, true);
          view.setInt32(textHandle + 8, textData, true);
          memory.set(encoded, textData);
          textHandles.push(textHandle);
          pointer = (textData + encoded.length + 7) & ~7;
        }

        view.setInt32(sequence, argv.length, true);
        view.setInt32(sequence + 4, argv.length, true);
        view.setInt32(sequence + 8, sequenceData, true);
        textHandles.forEach((handle, index) => {
          view.setBigInt64(sequenceData + index * 8, BigInt(handle), true);
        });
        argumentHandle = sequence;
        return sequence;
      },
    },
  };

  const instantiated = await WebAssembly.instantiate(decodeWasm(), imports);
  runtimeRef.current = instantiated.instance.exports as unknown as LogicExports;
  runtimeRef.current.main();

  if (output.length < 2) {
    throw new Error("LOGOS returned an incomplete Destiny recommendation.");
  }
  return { growthStage: output[0], weeklyQuest: output[1] };
}

export function questCategory(weeklyQuest: string) {
  const normalized = weeklyQuest.toLowerCase();
  if (normalized.includes("technical")) return "technical";
  if (normalized.includes("review")) return "reviews";
  if (normalized.includes("reddit") || normalized.includes("quora") || normalized.includes("distribut")) return "distribution";
  if (normalized.includes("content") || normalized.includes("keyword") || normalized.includes("page")) return "content";
  return "measurement";
}
