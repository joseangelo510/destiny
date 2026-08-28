import { describe, expect, it } from "vitest";

async function loadLoggingModule() {
  const modulePath = "./" + "logging";
  return import(/* @vite-ignore */ modulePath);
}

describe("structured application observability", () => {
  it("creates or preserves valid correlation IDs", async () => {
    const { correlationContext } = await loadLoggingModule();
    const existing = "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11";
    expect(correlationContext(new Headers({ "x-correlation-id": existing }))).toEqual({
      correlationId: existing,
      responseHeaders: { "x-correlation-id": existing },
    });
    const generated = correlationContext(new Headers({ "x-correlation-id": "invalid" }));
    expect(generated.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.responseHeaders["x-correlation-id"]).toBe(generated.correlationId);
  });

  it("emits a bounded, timestamped event contract", async () => {
    const { createLogEvent } = await loadLoggingModule();
    expect(createLogEvent({
      correlationId: "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11",
      event: "audit.started",
      severity: "info",
      context: { websiteId: "site-1" },
    }, () => new Date("2026-08-27T12:00:00.000Z"))).toEqual({
      schemaVersion: "1.0.0",
      timestamp: "2026-08-27T12:00:00.000Z",
      severity: "info",
      event: "audit.started",
      correlationId: "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11",
      context: { websiteId: "site-1" },
    });
    expect(() => createLogEvent({
      correlationId: "bad",
      event: "not valid",
      severity: "loud",
    })).toThrow("Invalid structured log event");
  });

  it("redacts PII and credentials before serialization", async () => {
    const { serializeLogEvent } = await loadLoggingModule();
    const serialized = serializeLogEvent({
      correlationId: "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11",
      event: "provider.failed",
      severity: "error",
      context: {
        authorization: "Bearer private",
        email: "person@example.com",
        nested: { apiKey: "private", safe: "visible" },
      },
    });
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("person@example.com");
    expect(JSON.parse(serialized)).toEqual(expect.objectContaining({
      context: {
        authorization: "[REDACTED]",
        email: "[REDACTED]",
        nested: { apiKey: "[REDACTED]", safe: "visible" },
      },
    }));
  });

  it("validates each field and permits every bounded severity", async () => {
    const { createLogEvent } = await loadLoggingModule();
    const correlationId = "018f3f5d-3e16-7c2a-9f2e-3c227fd77e11";
    for (const severity of ["debug", "info", "warn", "error"] as const) {
      expect(createLogEvent({ correlationId, event: "harness.completed", severity }).severity).toBe(severity);
    }
    expect(() => createLogEvent({ correlationId: "bad", event: "valid.event", severity: "info" })).toThrow(/correlationId/);
    expect(() => createLogEvent({ correlationId, event: "invalid", severity: "info" })).toThrow(/event/);
    expect(() => createLogEvent({ correlationId, event: "valid.event", severity: "fatal" as never })).toThrow(/severity/);
  });

  it("normalizes IDs and redacts arrays, bearer tokens, and cycles", async () => {
    const { correlationContext, serializeLogEvent } = await loadLoggingModule();
    const incoming = "018F3F5D-3E16-7C2A-9F2E-3C227FD77E11";
    expect(correlationContext(new Headers({ "x-correlation-id": `  ${incoming}  ` })).correlationId).toBe(incoming.toLowerCase());
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const serialized = serializeLogEvent({
      correlationId: incoming.toLowerCase(), event: "audit.completed", severity: "info",
      context: { values: ["Bearer private", circular], phone: "555-1234" },
    });
    expect(JSON.parse(serialized).context).toEqual({
      values: ["Bearer [REDACTED]", { self: "[CIRCULAR]" }], phone: "[REDACTED]",
    });
  });
});
