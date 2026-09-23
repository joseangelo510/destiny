"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import type { CreatorProspect } from "@/lib/distribution/recommendations";

type LiveCreator = {
  name: string;
  domain: string;
  platform: string;
  title: string;
  url: string;
  snippet?: string;
  matchedTopic: string;
  audienceEstimate: number | null;
  audienceVerification: "required";
  sourceKind: CreatorProspect["sourceKind"];
};

function initialToLive(item: CreatorProspect): LiveCreator {
  return { name: item.name, domain: item.domain, platform: item.platform, title: item.title, url: item.url, matchedTopic: item.keyword, audienceEstimate: null, audienceVerification: "required", sourceKind: item.sourceKind };
}

export function CreatorDiscovery({ initialCreators, paid, topics, websiteId, canManageBilling = true }: {
  initialCreators: CreatorProspect[];
  paid: boolean;
  canManageBilling?: boolean;
  topics: string[];
  websiteId: string;
}) {
  const [creators, setCreators] = useState(initialCreators.map(initialToLive));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function discover() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/distribution/creators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, topics }) });
    const payload = await response.json() as { rows?: LiveCreator[]; updatedAt?: string; error?: string };
    if (!response.ok || !payload.rows) setError(payload.error || "Rebound SEO could not refresh creator recommendations.");
    else { setCreators(payload.rows); setUpdatedAt(payload.updatedAt ?? new Date().toISOString()); }
    setLoading(false);
  }

  const candidates = creators.filter((creator) => creator.sourceKind === "candidate");
  const otherSources = creators.filter((creator) => creator.sourceKind !== "candidate");
  return <>
    <div className="creator-discovery-note"><strong>Audience filter</strong><span>Target 3,000–100,000 followers. Public search finds topic-related sources; confirm creator identity, audience size, and contact path before outreach.</span></div>
    {paid ? <div className="creator-discovery-actions"><button className="secondary-button" disabled={loading || !topics.length} onClick={() => void discover()} type="button">{loading ? "Finding creators…" : "Get more creator recommendations (5 searches)"}</button><small>{updatedAt ? `Public search checked ${new Date(updatedAt).toLocaleString()}. ` : ""}{topics[0] ? `First priority keyword: ${topics[0]}` : "Approve a priority keyword first"}</small></div> : null}
    <h3>Potential creator sources</h3>
    <div className="publisher-list">{candidates.map((creator, index) => {
      const brief = `Potential creator source: ${creator.name}\nPlatform: ${creator.platform}\nMatched topic: ${creator.matchedTopic}\nRelevant public source: ${creator.url}\n\nFirst verify the author, audience size and public contact path; do not assume the search result is an independent creator. If no verified public email exists, use the platform contact path. Then write a concise, personal subject line and outreach email. Never invent contact information.`;
      return <article key={`${creator.url}-${index}`}><div><span>{index + 1}</span><div><strong>{creator.name}</strong><p>{creator.title}</p><small>{creator.platform} · Matches “{creator.matchedTopic}” · Audience size needs verification</small></div></div><div><a className="text-button" href={creator.url} rel="noreferrer" target="_blank">Review source ↗</a>{paid ? <CopyButton text={brief} /> : null}</div></article>;
    })}</div>
    {!candidates.length ? <p className="empty-state">No potential creator source passed this public-result check. Review other sources below or try a more specific keyword; Rebound SEO will not invent a contact.</p> : null}
    {otherSources.length ? <><h3>Other sources to review</h3><p>These results are publishers or businesses, not verified outreach contacts.</p><div className="publisher-list">{otherSources.map((source, index) => <article key={`${source.url}-${index}`}><div><span>{index + 1}</span><div><strong>{source.name}</strong><p>{source.title}</p><small>{source.platform} · Creator identity and audience unverified</small></div></div><a className="text-button" href={source.url} rel="noreferrer" target="_blank">Review source ↗</a></article>)}</div></> : null}
    {!paid ? <aside className="upgrade-preview"><div><span>Personalized recommendations</span><strong>Unlock the complete creator list and outreach workflow</strong><p>Search across creator platforms using your approved keywords and prepare sourced outreach without fabricated emails.</p></div>{canManageBilling ? <Link className="primary-button" href="/account/billing">View upgrade options</Link> : <p>Ask the website owner to review the subscription.</p>}</aside> : null}
    {error ? <div className="error-banner" role="alert">{error}</div> : null}
  </>;
}
