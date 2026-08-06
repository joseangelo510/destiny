import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositorySource = fileURLToPath(new URL("../logic-engine/target/destiny-logic-engine.wasm", import.meta.url));
const workspaceSource = fileURLToPath(new URL("../../destiny-logic-engine/target/destiny-logic-engine.wasm", import.meta.url));
const source = await access(repositorySource).then(() => repositorySource).catch(() => workspaceSource);
const target = fileURLToPath(new URL("../supabase/functions/process-audit/wasm.ts", import.meta.url));
const serverTarget = fileURLToPath(new URL("../src/lib/logicaffeine-wasm.ts", import.meta.url));
const publicTarget = fileURLToPath(new URL("../public/logic/destiny-logic-engine.wasm", import.meta.url));
const bytes = await readFile(source);
const generated = `// Generated from destiny-logic-engine/src/main.lg. Do not edit by hand.\nexport const COMPILED_LOGOS_WASM_BASE64 = "${bytes.toString("base64")}";\n`;

await writeFile(target, generated);
await writeFile(serverTarget, generated);
await copyFile(source, publicTarget);
