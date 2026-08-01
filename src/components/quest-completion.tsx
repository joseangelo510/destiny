"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function QuestCompletion({ questId, status, xp }: { questId: string; status: string; xp: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const complete = status === "complete";

  const update = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/quests/${encodeURIComponent(questId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: complete ? "todo" : "complete" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Destiny could not update this quest.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not update this quest.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="quest-completion"><button className={complete ? "secondary-button" : "primary-button"} disabled={saving} onClick={() => void update()} type="button">{saving ? "Saving…" : complete ? "Reopen quest" : `Mark complete · +${xp} XP`}</button>{error && <span>{error}</span>}</div>;
}
