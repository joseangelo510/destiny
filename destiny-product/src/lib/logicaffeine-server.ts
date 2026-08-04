import { runDestinyLogicFromBytes, type DestinyLogicInput } from "./logicaffeine";
import { COMPILED_LOGOS_WASM_BASE64 } from "./logicaffeine-wasm";

function decodeWasm() {
  return Uint8Array.from(atob(COMPILED_LOGOS_WASM_BASE64), (character) => character.charCodeAt(0));
}

export function runDestinyServerLogic(input: DestinyLogicInput) {
  return runDestinyLogicFromBytes(input, decodeWasm());
}
