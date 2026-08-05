"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "../lib/supabase/client";
import {
  buildLlmSourceProgress,
  type LlmSourceKey,
  type LlmVisibilityTaskRecord,
} from "../lib/llm/source-progress";

type LlmVisibilitySignal = {
  status?: unknown;
  totalMentions?: unknown;
  platforms?: Array<{ platform?: unknown; mentions?: unknown }>;
};

type SkylineSource = {
  key: LlmSourceKey;
  label: string;
  icon: string;
  benchmark: number;
  guidance?: string;
};

const SKYLINE_SOURCES: readonly SkylineSource[] = [
  { key: "reddit", label: "Reddit", icon: "◉", benchmark: 40.1, guidance: "AI cites Reddit in 40% of answers. Real contributions in your niche build readiness." },
  { key: "wikipedia", label: "Wikipedia", icon: "▤", benchmark: 26.3 },
  { key: "youtube", label: "YouTube", icon: "▻", benchmark: 23.5 },
  { key: "owned-site", label: "Google", icon: "G", benchmark: 23.3 },
  { key: "reviews", label: "Yelp", icon: "☆", benchmark: 21.0 },
  { key: "linkedin", label: "LinkedIn", icon: "in", benchmark: 5.9 },
  { key: "quora", label: "Quora", icon: "Q", benchmark: 4.6 },
] as const;

const LLM_TASK_SELECT = "id,source_key,task_key,status,completed_at,proof_url,proof_attached_at,updated_at";
export const LLM_TASK_SYNC_INTERVAL_MS = 10_000;

export function llmTaskChannelName(websiteId: string) {
  return `destiny:llm-visibility:${websiteId}`;
}

export function parseLlmTaskSyncMessage(value: unknown, websiteId: string): LlmVisibilityTaskRecord | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { websiteId?: unknown; task?: unknown };
  if (message.websiteId !== websiteId || !message.task || typeof message.task !== "object") return null;
  const task = message.task as Partial<LlmVisibilityTaskRecord>;
  if (typeof task.source_key !== "string" || typeof task.task_key !== "string" || (task.status !== "todo" && task.status !== "complete")) return null;
  return task as LlmVisibilityTaskRecord;
}

export function nextSourceReadinessPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((Math.min(total, completed + 1) / total) * 100));
}

function upsertRecord(records: LlmVisibilityTaskRecord[], record: LlmVisibilityTaskRecord) {
  const next = records.filter((candidate) => candidate.source_key !== record.source_key || candidate.task_key !== record.task_key);
  return [...next, record];
}

function skylineStyle(benchmark: number) {
  return { "--benchmark-width": `${Math.round((benchmark / 40.1) * 1000) / 10}%` } as CSSProperties;
}

export function LlmSourceDashboard({
  websiteId,
  initialRecords,
  llmVisibility,
  initialProgress,
  initialSelectedSource = null,
}: {
  websiteId: string;
  initialRecords: LlmVisibilityTaskRecord[];
  llmVisibility: LlmVisibilitySignal;
  initialProgress: Awaited<ReturnType<typeof buildLlmSourceProgress>>;
  initialSelectedSource?: LlmSourceKey | null;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedSource, setSelectedSource] = useState<LlmSourceKey | null>(initialSelectedSource);
  const [savingTask, setSavingTask] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof buildLlmSourceProgress>>>(initialProgress);
  const [streak, setStreak] = useState(() => initialRecords.filter((record) => record.status === "complete" && SKYLINE_SOURCES.some((source) => source.key === record.source_key)).length);
  const [celebratingSource, setCelebratingSource] = useState<LlmSourceKey | null>(null);
  const [guidePrompt, setGuidePrompt] = useState("");

  useEffect(() => {
    let cancelled = false;
    void buildLlmSourceProgress({ records, llmVisibility }).then((next) => {
      if (!cancelled) setProgress(next);
    });
    return () => { cancelled = true; };
  }, [records, llmVisibility]);

  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    const applySyncedTask = (next: LlmVisibilityTaskRecord) => {
      if (!next?.source_key || !next?.task_key) return;
      setRecords((current) => upsertRecord(current, next));
    };
    const reconcile = async () => {
      const { data } = await supabase
        .from("llm_visibility_tasks")
        .select(LLM_TASK_SELECT)
        .eq("website_id", websiteId)
        .order("updated_at", { ascending: true });
      if (!stopped && data) setRecords(data as LlmVisibilityTaskRecord[]);
    };
    const channel = supabase
      .channel(`llm-visibility-tasks:${websiteId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "llm_visibility_tasks",
        filter: `website_id=eq.${websiteId}`,
      }, (payload) => {
        if (payload.eventType !== "DELETE") applySyncedTask(payload.new as LlmVisibilityTaskRecord);
      })
      .subscribe();
    const browserChannel = "BroadcastChannel" in window ? new window.BroadcastChannel(llmTaskChannelName(websiteId)) : null;
    if (browserChannel) browserChannel.onmessage = (event) => {
      const next = parseLlmTaskSyncMessage(event.data, websiteId);
      if (next) applySyncedTask(next);
    };
    const refreshOnFocus = () => { void reconcile(); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void reconcile(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const reconciliationTimer = window.setInterval(() => { void reconcile(); }, LLM_TASK_SYNC_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(reconciliationTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      browserChannel?.close();
      void supabase.removeChannel(channel);
    };
  }, [websiteId]);

  const activeConfig = SKYLINE_SOURCES.find((source) => source.key === selectedSource) ?? null;
  const activeSource = activeConfig ? progress.sources.find((source) => source.key === activeConfig.key) ?? null : null;
  const firstIncompleteTask = activeSource?.tasks.find((task) => task.status !== "complete") ?? null;

  const updateTask = async (sourceKey: LlmSourceKey, taskKey: string, status: "todo" | "complete") => {
    const identity = `${sourceKey}:${taskKey}`;
    const previous = records;
    const optimistic: LlmVisibilityTaskRecord = {
      source_key: sourceKey,
      task_key: taskKey,
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      proof_url: null,
      proof_attached_at: null,
    };
    setSavingTask(identity);
    setError("");
    setRecords((current) => upsertRecord(current, optimistic));
    try {
      const response = await fetch("/api/llm-visibility/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, sourceKey, taskKey, status, proofUrl: null }),
      });
      const payload = await response.json() as { error?: string; task?: LlmVisibilityTaskRecord };
      if (!response.ok || !payload.task) throw new Error(payload.error || "Destiny could not save this source task.");
      setRecords((current) => upsertRecord(current, payload.task!));
      if ("BroadcastChannel" in window) {
        const browserChannel = new window.BroadcastChannel(llmTaskChannelName(websiteId));
        browserChannel.postMessage({ websiteId, task: payload.task });
        browserChannel.close();
      }
      if (status === "complete") {
        setStreak((current) => current + 1);
        setCelebratingSource(sourceKey);
        window.setTimeout(() => setCelebratingSource((current) => current === sourceKey ? null : current), 800);
      }
    } catch (cause) {
      setRecords(previous);
      setError(cause instanceof Error ? cause.message : "Destiny could not save this source task.");
    } finally {
      setSavingTask("");
    }
  };

  const openSource = (sourceKey: LlmSourceKey) => {
    setSelectedSource(sourceKey);
    setGuidePrompt("");
  };

  const openGuide = () => {
    if (!activeConfig || !firstIncompleteTask) return;
    setGuidePrompt(`Help me complete this ${activeConfig.label} readiness task step by step: ${firstIncompleteTask.title}`);
  };

  return <section className="llm-signal-playboard" aria-labelledby="llm-playboard-title">
    <header className="llm-playboard-header">
      <div>
        <h1 id="llm-playboard-title">AI visibility playboard</h1>
        <p>Ghost bars show how often AI cites each source. Your color shows your readiness.</p>
      </div>
      <div className="llm-playboard-streak" aria-label={`${streak} task streak`}><span>Streak</span><strong><i>♨</i>{streak}</strong></div>
    </header>

    <div className="llm-playboard-legend" aria-label="Playboard legend">
      <span><i className="readiness" />Your readiness</span>
      <span><i className="benchmark" />AI citation benchmark</span>
      <span><i className="verified">♙</i>Verified AI citation</span>
    </div>

    <div className="llm-compact-source-list" aria-label="AI visibility source benchmarks">
      {SKYLINE_SOURCES.map((config) => {
        const source = progress.sources.find((candidate) => candidate.key === config.key);
        if (!source) return null;
        const selected = config.key === selectedSource;
        const verified = false;
        return <button
          aria-controls="llm-source-drawer"
          aria-expanded={selected}
          className={`llm-compact-source-row ${selected ? "selected" : ""}`}
          data-signal-source={config.key}
          key={config.key}
          onClick={() => openSource(config.key)}
          style={skylineStyle(config.benchmark)}
          type="button"
        >
          <span className="llm-compact-source-line">
            <span className="llm-compact-source-name"><i>{config.icon}</i><strong>{config.label}</strong>{verified && <b>♙ Verified citation</b>}</span>
            <span className="llm-compact-source-stat">You <strong>{source.percent}%</strong> · Benchmark {config.benchmark}%</span>
          </span>
          <span className="llm-compact-benchmark"><i><b style={{ width: `${source.percent}%` }} /></i></span>
          {celebratingSource === config.key && <span aria-hidden="true" className="llm-bar-confetti"><i /><i /><i /><i /><i /><i /></span>}
        </button>;
      })}
    </div>

    {activeSource && activeConfig && <section className="llm-source-drawer" id="llm-source-drawer">
      <header><h2>{activeConfig.label} playbook</h2><button aria-label="Close playbook" onClick={() => { setSelectedSource(null); setGuidePrompt(""); }} type="button">Close</button></header>
      <p>{activeConfig.guidance ?? activeSource.summary}</p>
      <div className="llm-plain-checklist">
        {activeSource.tasks.map((task) => {
          const identity = `${activeSource.key}:${task.key}`;
          return <label className={task.status === "complete" ? "complete" : ""} key={task.key}>
            <input checked={task.status === "complete"} disabled={savingTask === identity} onChange={() => void updateTask(activeSource.key, task.key, task.status === "complete" ? "todo" : "complete")} type="checkbox" />
            <span>{task.title}</span>
          </label>;
        })}
      </div>
      <button className="llm-guide-button" disabled={!firstIncompleteTask} onClick={openGuide} type="button">Ask Destiny for a step by step guide ↗</button>
      {guidePrompt && <div className="llm-inline-guide" aria-live="polite"><strong>Destiny is ready to help</strong><textarea aria-label="Prefilled Destiny prompt" readOnly value={guidePrompt} /></div>}
    </section>}

    {error && <p className="llm-playboard-error" role="alert">{error}</p>}
  </section>;
}
