"use client";

import { useRef, useState } from "react";
import { WorkspaceLink as Link } from "./workspace-link";
import { calendarTopicHref } from "@/lib/content/plan-links";

export type ContentPlanSave = { state: "adding" | "saved" | "error"; approved?: boolean; url?: string; message?: string };

export function useKeywordContentPlan({ websiteId, auditId, approve, refresh }: {
  websiteId: string; auditId: string; approve: (keyword: string) => Promise<boolean>; refresh: () => void;
}) {
  const [entries, setEntries] = useState<Record<string, ContentPlanSave>>({});
  const inFlight = useRef(false);
  const add = async (keyword: string, alreadyApproved: boolean, pageType: string) => {
    if (inFlight.current || entries[keyword]?.state === "saved") return;
    inFlight.current = true;
    setEntries(current => ({ ...current, [keyword]: { state: "adding", approved: alreadyApproved } }));
    let approved = alreadyApproved;
    try {
      if (!approved) approved = await approve(keyword);
      if (!approved) throw new Error("The topic could not be added. Try again.");
      const response = await fetch("/api/keywords/create-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, auditId, keyword, pageType }) });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error("Your topic is approved, but its brief could not be saved. Retry to finish adding it.");
      setEntries(current => ({ ...current, [keyword]: { state: "saved", approved: true, url: payload.url } }));
    } catch (cause) {
      setEntries(current => ({ ...current, [keyword]: { state: "error", approved, message: cause instanceof Error ? cause.message : "The brief could not be saved. Try again." } }));
    } finally { inFlight.current = false; refresh(); }
  };
  const forget = (keyword: string) => setEntries(current => { const next = { ...current }; delete next[keyword]; return next; });
  return { entries, add, forget, busy: Object.values(entries).some(entry => entry.state === "adding") };
}

export function KeywordContentPlanConfirmation({ keyword, websiteId, entry, retry }: { keyword: string; websiteId: string; entry: ContentPlanSave; retry: () => void }) {
  return <tr className="claude-ks-plan-confirmation-row"><td colSpan={6}><div className="claude-ks-plan-confirmation" role="status" aria-live="polite" aria-atomic="true">
    <div><strong>{entry.state === "saved" ? "Added to your content plan" : entry.state === "adding" ? "Adding to your content plan…" : entry.approved ? "Topic approved · brief needs another attempt" : "Topic not added"}</strong><p>{keyword}</p><small>{entry.state === "saved" ? "Available in Calendar under Unscheduled topics." : entry.message ?? "Saving your topic and brief."}</small></div>
    <div className="claude-ks-plan-next">{entry.state === "saved" ? <><div><Link className="claude-ks-calendar-link" href={calendarTopicHref(keyword, websiteId)}>View in Calendar</Link><Link href={entry.url!}>Start draft</Link></div><small>No publication date set.</small></> : entry.state === "error" ? <button onClick={retry} type="button">Retry</button> : null}</div>
  </div></td></tr>;
}
