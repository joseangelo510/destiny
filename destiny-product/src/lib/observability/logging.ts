const CORRELATION_HEADER = "x-correlation-id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const SEVERITIES = new Set(["debug", "info", "warn", "error"]);
const PRIVATE_KEY = /(?:authorization|cookie|email|password|phone|secret|service[_-]?role[_-]?key|token|api[_-]?key)/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export type LogSeverity = "debug" | "info" | "warn" | "error";

export type StructuredLogInput = {
  correlationId: string;
  event: string;
  severity: LogSeverity;
  context?: Record<string, unknown>;
};

export type StructuredLogEvent = StructuredLogInput & {
  schemaVersion: "1.0.0";
  timestamp: string;
  context?: Record<string, unknown>;
};

function nextCorrelationId() {
  return globalThis.crypto.randomUUID();
}

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return value.replace(BEARER, "Bearer [REDACTED]");
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    PRIVATE_KEY.test(key) ? "[REDACTED]" : redact(item, seen),
  ]));
}

export function correlationContext(headers: Headers) {
  const incoming = headers.get(CORRELATION_HEADER)?.trim().toLowerCase();
  const correlationId = incoming && UUID.test(incoming) ? incoming : nextCorrelationId();
  return {
    correlationId,
    responseHeaders: { [CORRELATION_HEADER]: correlationId },
  };
}

export function createLogEvent(input: StructuredLogInput, now = () => new Date()): StructuredLogEvent {
  const errors = [];
  if (!UUID.test(input.correlationId)) errors.push("correlationId");
  if (!EVENT.test(input.event)) errors.push("event");
  if (!SEVERITIES.has(input.severity)) errors.push("severity");
  if (errors.length) throw new Error(`Invalid structured log event fields: ${errors.join(", ")}.`);
  return {
    schemaVersion: "1.0.0",
    timestamp: now().toISOString(),
    severity: input.severity,
    event: input.event,
    correlationId: input.correlationId,
    ...(input.context ? { context: redact(input.context) as Record<string, unknown> } : {}),
  };
}

export function serializeLogEvent(input: StructuredLogInput) {
  return JSON.stringify(createLogEvent(input));
}
