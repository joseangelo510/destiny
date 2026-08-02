"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLAN_TIERS, type PlanTierId } from "@/lib/plans/weekly-plan";

export function PlanSelector({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<PlanTierId | null>(null);
  const [error, setError] = useState("");
  const choose = async (tier: PlanTierId) => {
    setSaving(tier);
    setError("");
    const response = await fetch("/api/plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteId, tier }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setError(payload.error || "Destiny could not save your plan."); setSaving(null); return; }
    router.refresh();
  };
  return <section className="plan-choice-panel">
    <div className="plan-choice-copy"><span className="eyebrow">Your audit is complete</span><h2>How fast do you want to grow?</h2><p>Choose a weekly pace. You can change it later; Destiny will reveal only the tasks that fit your time.</p></div>
    <div className="plan-choice-grid">{PLAN_TIERS.map((tier) => <button disabled={saving !== null} key={tier.id} onClick={() => void choose(tier.id)} type="button"><span>{tier.label}</span><strong>{tier.taskCount} tasks</strong><small>About {tier.minutes} minutes/week</small><p>{tier.description}</p><b>{saving === tier.id ? "Saving…" : "Choose this pace →"}</b></button>)}</div>
    {error && <div className="error-banner">{error}</div>}
  </section>;
}
