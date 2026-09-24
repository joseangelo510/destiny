import { describe, expect, it } from "vitest";
import { classifyResearchWorkerFailure } from "./research-worker-failure";

function workerError(status: number, payload: unknown) {
  return { message: "Edge Function returned a non-2xx status code", context: Response.json(payload, { status }) };
}

describe("classifyResearchWorkerFailure", () => {
  it("keeps a provider HTTP status for support without disclosing upstream details to customers", async () => {
    const failure = await classifyResearchWorkerFailure(workerError(502, { error: "DataForSEO returned HTTP 402." }));
    expect(failure).toEqual({
      code: "RESEARCH_PROVIDER_UNAVAILABLE",
      message: "Live search data is temporarily unavailable. Please try again later.",
      diagnostic: { kind: "provider_http", edgeStatus: 502, providerStatus: 402 },
    });
  });

  it("distinguishes insufficient article evidence from a transport failure", async () => {
    const failure = await classifyResearchWorkerFailure(workerError(502, { error: "DataForSEO did not return enough credible sources for this article yet." }));
    expect(failure.code).toBe("RESEARCH_SOURCES_INSUFFICIENT");
    expect(failure.message).toContain("enough reliable sources");
    expect(failure.diagnostic.kind).toBe("sources_insufficient");
  });

  it("never echoes an arbitrary upstream error or malformed response", async () => {
    const raw = "credential=secret-value query=private-client-data";
    const arbitrary = await classifyResearchWorkerFailure(workerError(502, { error: raw }));
    const malformed = await classifyResearchWorkerFailure({ context: new Response("not JSON", { status: 502 }) });
    const missing = await classifyResearchWorkerFailure(new Error(raw));
    for (const failure of [arbitrary, malformed, missing]) {
      expect(failure.message).not.toContain(raw);
      expect(JSON.stringify(failure.diagnostic)).not.toContain(raw);
      expect(failure.code).toBe("RESEARCH_UNAVAILABLE");
    }
  });
});
