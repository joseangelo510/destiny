type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("sc-domain:")) return trimmed.slice("sc-domain:".length).replace(/^www\./, "").replace(/\.$/, "");
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

export type GoogleAnalyticsSelectionState = {
  metadata: JsonRecord | null;
  selectedResource: string | null;
  status: "verified" | "selection_required" | "unverified";
  message: string;
};

export function googleAnalyticsSelectionState(value: unknown, websiteDomain: string): GoogleAnalyticsSelectionState {
  const metadata = record(value);
  const domain = normalizedDomain(websiteDomain);
  if (metadata.selectionRequired === true) {
    return {
      metadata: null,
      selectedResource: null,
      status: "selection_required",
      message: `Choose a Google Analytics property verified for ${domain || "this website"}.`,
    };
  }
  const selected = record(metadata.selectedProperty);
  const property = text(selected.property);
  const displayName = text(selected.displayName);
  const matchedDomain = normalizedDomain(text(selected.matchedDomain));
  const verified = Boolean(domain && property && selected.matchesWebsite === true && matchedDomain === domain);
  if (!verified) {
    return {
      metadata: null,
      selectedResource: property ? [displayName, property].filter(Boolean).join(" · ") : null,
      status: "unverified",
      message: `Sync Google Analytics to verify the property for ${domain || "this website"}. Existing metrics are hidden until then.`,
    };
  }
  return {
    metadata,
    selectedResource: [displayName, property].filter(Boolean).join(" · "),
    status: "verified",
    message: `Google Analytics is verified for ${domain}.`,
  };
}
