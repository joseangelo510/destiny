export type VerifiedResult = {
  value: string;
  label: string;
  title: string;
  detail: string;
  source: string;
};

export function selectVerifiedResult({
  organicKeyEvents,
  searchClicks,
  searchImpressions,
}: {
  organicKeyEvents: number;
  searchClicks: number;
  searchImpressions: number;
}): VerifiedResult | null {
  if (organicKeyEvents > 0) return {
    value: Math.round(organicKeyEvents).toLocaleString("en-US"),
    label: "organic conversions",
    title: "Your search work is creating action.",
    detail: "Organic visitors completed a tracked website conversion in the latest connected period.",
    source: "Google Analytics",
  };
  if (searchClicks > 0) return {
    value: Math.round(searchClicks).toLocaleString("en-US"),
    label: "search clicks",
    title: "People are finding—and choosing—you.",
    detail: "Google Search sent visitors to your website in the latest connected period.",
    source: "Google Search Console",
  };
  if (searchImpressions > 0) return {
    value: Math.round(searchImpressions).toLocaleString("en-US"),
    label: "search appearances",
    title: "Your visibility is taking shape.",
    detail: "Your website appeared in Google Search in the latest connected period.",
    source: "Google Search Console",
  };
  return null;
}

export function VerifiedResultSpotlight({ result }: { result: VerifiedResult | null }) {
  if (!result) return null;
  return <section aria-label="Verified result" className="verified-result-spotlight">
    <div className="verified-result-burst" aria-hidden="true"><span>✓</span></div>
    <div className="verified-result-copy"><span>Verified result</span><h2>{result.title}</h2><p>{result.detail}</p><small>{result.source} · connected first-party data—not a projection</small></div>
    <div className="verified-result-value"><strong>{result.value}</strong><span>{result.label}</span></div>
  </section>;
}
