import { createHash, randomUUID } from "node:crypto";

const SECRET_KEY = /(?:authorization|cookie|password|secret|service[_-]?role[_-]?key|token|api[_-]?key)/i;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

function redactString(value) {
  return value.replace(BEARER_VALUE, "Bearer [REDACTED]");
}

export function redactEvidence(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactEvidence(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SECRET_KEY.test(key) ? "[REDACTED]" : redactEvidence(item, seen),
  ]));
}

export function hashEvidenceFiles(files) {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const contents = typeof file.contents === "string" ? file.contents : JSON.stringify(file.contents);
    hash.update(file.path);
    hash.update("\0");
    hash.update(String(Buffer.byteLength(contents)));
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function createTraceRecorder({ runId = randomUUID(), sha, write, now = () => performance.now() }) {
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error("Harness trace requires a full Git SHA.");
  if (typeof write !== "function") throw new Error("Harness trace requires a write function.");
  const starts = new Map();

  async function emit(event) {
    await write(`${JSON.stringify(redactEvidence({
      schemaVersion: "2.0.0",
      runId,
      sha: sha.toLowerCase(),
      ...event,
    }))}\n`);
  }

  return {
    async start(stepId, details = {}) {
      if (starts.has(stepId)) throw new Error(`Harness step ${stepId} already started.`);
      starts.set(stepId, now());
      await emit({ phase: "start", stepId, details });
    },
    async finish(stepId, status, details = {}) {
      if (!starts.has(stepId)) throw new Error(`Harness step ${stepId} did not start.`);
      const durationMs = Math.max(0, now() - starts.get(stepId));
      starts.delete(stepId);
      await emit({ phase: "finish", stepId, status, durationMs, details });
    },
  };
}
