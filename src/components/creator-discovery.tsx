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
};

function initialToLive(item: CreatorProspect): LiveCreator {
  return { name: item.name, domain: item.domain, platform: item.platform, title: item.title, url: item.url, matchedTopic: item.keyword, audienceEstimate: null, audienceVerification: "required" };
}

export function CreatorDiscovery({ initialCreators, paid, topics, websiteId }: {
  initialCreators: CreatorProspect[];
  paid: boolean;
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
    if (!response.ok || !payload.rows) setError(payload.error || "Destiny could not refresh creator recommendations.");
    else { setCreators(payload.rows); setUpdatedAt(payload.updatedAt ?? new Date().toISOString()); }
    setLoading(false);
  }

  const visible = paid ? creators : creators.slice(0, 5);
  return <>
    <div className="creator-discovery-note"><strong>Audience filter</strong><span>Target 3,000–100,000 followers. Destiny verifies topic relevance first; audience size must be confirmed before outreach.</span></div>
    {paid ? <div className="creator-discovery-actions"><button className="secondary-button" disabled={loading || !topics.length} onClick={() => void discover()} type="button">{loading ? "Finding creators…" : "Get more creator recommendations"}</button><small>{updatedAt ? `Public search checked ${new Date(updatedAt).toLocaleString()}.` : `Researches: ${topics.slice(0, 3).join(" · ") || "Approve priority keywords first"}`}</small></div> : null}
    <div className="publisher-list">{visible.map((creator, index) => {
      const brief = `Creator: ${creator.name}\nPlatform: ${creator.platform}\nMatched topic: ${creator.matchedTopic}\nRelevant public source: ${creator.url}\n\nFind a public contact path and cite its source URL. If no verified public email exists, use the platform contact path. Then write a concise, personal subject line and outreach email. Never invent contact information.`;
      return <article key={`${creator.url}-${index}`}><div><span>{index + 1}</span><div><strong>{creator.name}</strong><p>{creator.title}</p><small>{creator.platform} · Matches “{creator.matchedTopic}” · Audience size needs verification</small></div></div><div><a className="text-button" href={creator.url} rel="noreferrer" target="_blank">Review source ↗</a>{paid ? <CopyButton text={brief} /> : null}</div></article>;
    })}</div>
    {!visible.length ? <p className="empty-state">No niche creator source passed the current public-result check. Destiny will not substitute major media or fabricate a contact.</p> : null}
    {!paid ? <aside className="upgrade-preview"><div><span>Personalized recommendations</span><strong>Unlock the complete creator list and outreach workflow</strong><p>Search across creator platforms using your approved keywords and prepare sourced outreach without fabricated emails.</p></div><Link className="primary-button" href="/#pricing">View upgrade options</Link></aside> : null}
    {error ? <div className="error-banner" role="alert">{error}</div> : null}
  </>;
}
