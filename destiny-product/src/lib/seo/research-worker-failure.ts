type ResearchFailureKind = "provider_http" | "sources_insufficient" | "unknown";

export type ResearchWorkerFailure = {
  code: "RESEARCH_PROVIDER_UNAVAILABLE" | "RESEARCH_SOURCES_INSUFFICIENT" | "RESEARCH_UNAVAILABLE";
  message: string;
  diagnostic: { kind: ResearchFailureKind; edgeStatus: number | null; providerStatus: number | null };
};

export async function classifyResearchWorkerFailure(error: unknown): Promise<ResearchWorkerFailure> {
  const context = error && typeof error === "object" && "context" in error && error.context instanceof Response
    ? error.context
    : null;
  const edgeStatus = context?.status ?? null;
  const payload = await context?.clone().json().catch(() => null);
  const reason = payload && typeof payload === "object" && !Array.isArray(payload) && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : null;
  const providerMatch = reason?.match(/^DataForSEO returned HTTP (4\d\d|5\d\d)\.$/);

  if (providerMatch) {
    return {
      code: "RESEARCH_PROVIDER_UNAVAILABLE",
      message: "Live search data is temporarily unavailable. Please try again later.",
      diagnostic: { kind: "provider_http", edgeStatus, providerStatus: Number(providerMatch[1]) },
    };
  }

  if (reason === "DataForSEO did not return enough credible sources for this article yet.") {
    return {
      code: "RESEARCH_SOURCES_INSUFFICIENT",
      message: "We couldn't verify enough reliable sources for this article yet. Try a broader keyword or try again later.",
      diagnostic: { kind: "sources_insufficient", edgeStatus, providerStatus: null },
    };
  }

  return {
    code: "RESEARCH_UNAVAILABLE",
    message: "Live search data is temporarily unavailable. Please try again later.",
    diagnostic: { kind: "unknown", edgeStatus, providerStatus: null },
  };
}
