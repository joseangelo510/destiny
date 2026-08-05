"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  AI_ENGINE_CITATION_SNAPSHOTS,
  buildLlmSourceProgress,
  citationDomainPlaybookKey,
  type LlmSourceKey,
  type LlmVisibilityTaskRecord,
} from "../lib/llm/source-progress";

type LlmVisibilitySignal = {
  status?: unknown;
  totalMentions?: unknown;
  platforms?: Array<{ platform?: unknown; mentions?: unknown }>;
};

type CitationBenchmarkId = (typeof AI_ENGINE_CITATION_SNAPSHOTS)[number]["id"];

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

function upsertRecord(records: LlmVisibilityTaskRecord[], record: LlmVisibilityTaskRecord) {
  const next = records.filter((candidate) => candidate.source_key !== record.source_key || candidate.task_key !== record.task_key);
  return [...next, record];
}

function sourceEngines(domain: string) {
  return AI_ENGINE_CITATION_SNAPSHOTS
    .filter((snapshot) => snapshot.domains.some((item) => item.domain === domain))
    .map((snapshot) => snapshot.label);
}

export function LlmSourceDashboard({
  websiteId,
  initialRecords,
  llmVisibility,
  initialProgress,
}: {
  websiteId: string;
  initialRecords: LlmVisibilityTaskRecord[];
  llmVisibility: LlmVisibilitySignal;
  initialProgress: Awaited<ReturnType<typeof buildLlmSourceProgress>>;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [selectedSource, setSelectedSource] = useState<LlmSourceKey>("owned-site");
  const [selectedBenchmark, setSelectedBenchmark] = useState<CitationBenchmarkId>(AI_ENGINE_CITATION_SNAPSHOTS[0].id);
  const [proofDrafts, setProofDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialRecords.flatMap((record) => record.proof_url ? [[`${record.source_key}:${record.task_key}`, record.proof_url]] : [])));
  const [savingTask, setSavingTask] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof buildLlmSourceProgress>>>(initialProgress);

  useEffect(() => {
    let cancelled = false;
    void buildLlmSourceProgress({ records, llmVisibility }).then((next) => {
      if (cancelled) return;
      setProgress(next);
      if (next.nextTask) setSelectedSource((current) => current || next.nextTask!.sourceKey);
    });
    return () => { cancelled = true; };
  }, [records, llmVisibility]);

  useEffect(() => {
    const supabase = createClient();
    let stopped = false;
    const applySyncedTask = (next: LlmVisibilityTaskRecord, message: string) => {
      if (!next?.source_key || !next?.task_key) return;
      setRecords((current) => upsertRecord(current, next));
      if (next.proof_url) setProofDrafts((current) => ({ ...current, [`${next.source_key}:${next.task_key}`]: next.proof_url! }));
      setStatusMessage(message);
    };
    const reconcile = async () => {
      const { data } = await supabase
        .from("llm_visibility_tasks")
        .select(LLM_TASK_SELECT)
        .eq("website_id", websiteId)
        .order("updated_at", { ascending: true });
      if (stopped || !data) return;
      setRecords(data as LlmVisibilityTaskRecord[]);
    };
    const channel = supabase
      .channel(`llm-visibility-tasks:${websiteId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "llm_visibility_tasks",
        filter: `website_id=eq.${websiteId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const next = payload.new as LlmVisibilityTaskRecord;
        applySyncedTask(next, "Progress updated across your workspace.");
      })
      .subscribe();
    const browserChannel = typeof window !== "undefined" && "BroadcastChannel" in window
      ? new window.BroadcastChannel(llmTaskChannelName(websiteId))
      : null;
    if (browserChannel) {
      browserChannel.onmessage = (event) => {
        const next = parseLlmTaskSyncMessage(event.data, websiteId);
        if (next) applySyncedTask(next, "Progress updated in another Destiny tab.");
      };
    }
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

  useEffect(() => {
    const openSource = (event: Event) => {
      const sourceKey = (event as CustomEvent<{ sourceKey?: LlmSourceKey }>).detail?.sourceKey;
      if (!sourceKey || !progress.sources.some((source) => source.key === sourceKey)) return;
      setSelectedSource(sourceKey);
      window.setTimeout(() => document.getElementById("llm-source-playbook")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    };
    window.addEventListener("destiny:open-llm-source", openSource);
    return () => window.removeEventListener("destiny:open-llm-source", openSource);
  }, [progress.sources]);

  const activeSource = progress.sources.find((source) => source.key === selectedSource) ?? progress.sources[0];
  const activeBenchmark = AI_ENGINE_CITATION_SNAPSHOTS.find((snapshot) => snapshot.id === selectedBenchmark) ?? AI_ENGINE_CITATION_SNAPSHOTS[0];
  const benchmarkMax = Math.max(...activeBenchmark.domains.map((domain) => domain.share));

  const updateTask = async (sourceKey: LlmSourceKey, taskKey: string, status: "todo" | "complete", proofUrl: string | null = null) => {
    const identity = `${sourceKey}:${taskKey}`;
    const previous = records;
    const optimistic: LlmVisibilityTaskRecord = {
      source_key: sourceKey,
      task_key: taskKey,
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      proof_url: status === "complete" ? proofUrl : null,
      proof_attached_at: status === "complete" && proofUrl ? new Date().toISOString() : null,
    };
    setSavingTask(identity);
    setError("");
    setStatusMessage("");
    setRecords((current) => upsertRecord(current, optimistic));
    try {
      const response = await fetch("/api/llm-visibility/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, sourceKey, taskKey, status, proofUrl }),
      });
      const payload = await response.json() as { error?: string; task?: LlmVisibilityTaskRecord };
      if (!response.ok || !payload.task) throw new Error(payload.error || "Destiny could not save this source task.");
      setRecords((current) => upsertRecord(current, payload.task!));
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const browserChannel = new window.BroadcastChannel(llmTaskChannelName(websiteId));
        browserChannel.postMessage({ websiteId, task: payload.task });
        browserChannel.close();
      }
      setStatusMessage(status === "complete" ? proofUrl ? "Action and public proof saved. Your progress map is up to date." : "Action saved. Your readiness map is up to date." : "Action reopened. Your readiness map is up to date.");
    } catch (cause) {
      setRecords(previous);
      setError(cause instanceof Error ? cause.message : "Destiny could not save this source task.");
    } finally {
      setSavingTask("");
    }
  };

  const openBenchmarkPlaybook = (sourceKey: LlmSourceKey) => {
    setSelectedSource(sourceKey);
    document.getElementById("llm-source-playbook")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <div className="llm-source-dashboard">
    <section className="llm-progress-hero" aria-labelledby="llm-progress-title">
      <article className="llm-readiness-summary">
        <div className="llm-summary-topline"><span>Source readiness</span><b>Live workspace updates</b></div>
        <div className="llm-readiness-number"><strong>{progress.readiness.percent}%</strong><div><h2 id="llm-progress-title">Your AI visibility map</h2><p>{progress.readiness.label}</p></div></div>
        <div className="llm-readiness-track" role="progressbar" aria-label="Source readiness" aria-valuemin={0} aria-valuemax={progress.readiness.total} aria-valuenow={progress.readiness.completed}><span style={{ width: `${progress.readiness.percent}%` }} /></div>
        <small>Action progress only. A completed checklist is not a verified AI mention or citation.</small>
      </article>
      <article className="llm-next-action">
        <span>Next useful step</span>
        <strong>{progress.nextTask ? progress.nextTask.title : "Keep monitoring evidence"}</strong>
        <p>{progress.nextTask ? `${progress.nextTask.sourceName} · ${progress.nextTask.description}` : "Your source-readiness work is complete. Destiny will keep verified provider evidence separate."}</p>
        {progress.nextTask && <button onClick={() => setSelectedSource(progress.nextTask!.sourceKey)} type="button">Open this source →</button>}
      </article>
      <article className={`llm-verified-summary ${progress.verifiedVisibility.detected ? "detected" : ""}`}>
        <span>Verified visibility</span>
        <strong>{progress.verifiedVisibility.label}</strong>
        <p>{progress.verifiedVisibility.evidenceAvailable ? "Based on available provider monitoring—not checklist completion." : "Run supported AI visibility research to begin provider monitoring."}</p>
        <a href="#verified-evidence">View evidence ledger ↓</a>
      </article>
    </section>

    <section aria-labelledby="llm-truth-ledger-title" className="llm-truth-ledger workspace-card">
      <div className="workspace-card-heading"><div><strong id="llm-truth-ledger-title">Three truthful progress states</strong><small>Destiny never turns a checkbox or attached link into a detected AI citation</small></div></div>
      <div className="llm-truth-ledger-grid">
        <article><span>1</span><div><strong>Work completed</strong><b>{progress.readiness.completed}/{progress.readiness.total}</b><p>Self-reported source-readiness actions.</p></div></article>
        <article><span>2</span><div><strong>Public proof attached</strong><b>{progress.publicProof.attached}/{progress.publicProof.possible}</b><p>{progress.publicProof.attached} of {progress.publicProof.possible} proof-bearing actions. User-attached, not automatically verified.</p></div></article>
        <article><span>3</span><div><strong>Provider-detected visibility</strong><b>{progress.verifiedVisibility.detected ? progress.verifiedVisibility.totalMentions.toLocaleString() : "—"}</b><p>{progress.verifiedVisibility.label}</p></div></article>
      </div>
    </section>

    <section className="workspace-card llm-source-map-section">
      <div className="workspace-card-heading"><div><strong>Build source readiness, one ecosystem at a time</strong><small>Choose a source to open its three-step playbook</small></div><span>{progress.sources.filter((source) => source.state === "complete").length}/{progress.sources.length} sources complete</span></div>
      <div className="llm-source-map" aria-label="Source progress map">
        {progress.sources.map((source, index) => {
          const engines = sourceEngines(source.domain);
          const selected = source.key === activeSource.key;
          return <button
            aria-controls="llm-source-playbook"
            aria-expanded={selected}
            className={`llm-source-node ${source.state} ${selected ? "selected" : ""}`}
            data-source-key={source.key}
            key={source.key}
            onClick={() => setSelectedSource(source.key)}
            type="button"
          >
            <span className="llm-source-step">{source.state === "complete" ? "✓" : index + 1}</span>
            <span className="llm-source-node-copy"><strong>{source.name}</strong><small>{source.completed}/{source.total} actions · {source.category === "earned" ? "earned or eligibility-dependent" : source.category}</small>{source.proofPossible > 0 && <small>{source.proofAttached}/{source.proofPossible} public proof attached</small>}{engines.length > 0 && <em>Appears in {engines.slice(0, 2).join(" + ")} benchmark</em>}</span>
            <span className="llm-source-mini-track" aria-hidden="true"><i style={{ width: `${source.percent}%` }} /></span>
          </button>;
        })}
      </div>

      <article className="llm-source-playbook" id="llm-source-playbook">
        <header><div><span>{activeSource.domain}</span><h2>{activeSource.name} playbook</h2><p>{activeSource.summary}</p></div><strong>{activeSource.completed}/{activeSource.total} done</strong></header>
        <div className="llm-source-expectation"><strong>What completing this means</strong><p>{activeSource.expectation}</p></div>
        <div className="llm-source-task-list">
          {activeSource.tasks.map((task, index) => {
            const identity = `${activeSource.key}:${task.key}`;
            const complete = task.status === "complete";
            const external = task.actionHref.startsWith("http");
            const proofDraft = proofDrafts[identity] ?? task.proofUrl ?? "";
            const proofChanged = proofDraft.trim() !== (task.proofUrl ?? "");
            return <article className={complete ? "complete" : "todo"} key={task.key}>
              <span>{complete ? "✓" : index + 1}</span>
              <div><strong>{task.title}</strong><p>{task.description}</p>{task.completedAt && <small>Marked done {new Date(task.completedAt).toLocaleDateString()}</small>}{task.requiresProof && <div className="llm-task-proof"><label htmlFor={`proof-${activeSource.key}-${task.key}`}><span>Public proof URL · {task.proofLabel ?? "Published work"}</span><input id={`proof-${activeSource.key}-${task.key}`} inputMode="url" onChange={(event) => setProofDrafts((current) => ({ ...current, [identity]: event.target.value }))} placeholder={task.proofPlaceholder} type="url" value={proofDraft} /></label><small>Proof is user-attached and not provider verification.</small>{task.proofUrl && <a href={task.proofUrl} rel="noreferrer" target="_blank">Open attached proof ↗</a>}</div>}</div>
              <div className="llm-task-actions"><a href={task.actionHref} rel={external ? "noreferrer" : undefined} target={external ? "_blank" : undefined}>{task.actionLabel}{external ? " ↗" : " →"}</a>{complete && task.requiresProof && proofChanged && <button disabled={savingTask === identity || !proofDraft.trim()} onClick={() => void updateTask(activeSource.key, task.key, "complete", proofDraft.trim())} type="button">{savingTask === identity ? "Saving…" : "Save proof"}</button>}<button disabled={savingTask === identity || (!complete && Boolean(task.requiresProof) && !proofDraft.trim())} onClick={() => void updateTask(activeSource.key, task.key, complete ? "todo" : "complete", complete ? null : proofDraft.trim() || null)} type="button">{savingTask === identity ? "Saving…" : complete ? "Reopen" : task.requiresProof ? "Attach proof & complete" : "Mark done"}</button></div>
            </article>;
          })}
        </div>
      </article>
      <div aria-live="polite" className="llm-save-status">{error ? <span className="error-banner">{error}</span> : statusMessage}</div>
    </section>

    <section className="workspace-card llm-benchmark-card">
      <div className="workspace-card-heading"><div><strong>Benchmark lens</strong><small>See why Destiny uses multiple source paths instead of one universal ranking</small></div><span>Market benchmark, not your evidence</span></div>
      <div className="llm-benchmark-tabs" role="tablist" aria-label="AI engine citation benchmark">
        {AI_ENGINE_CITATION_SNAPSHOTS.map((snapshot) => <button aria-selected={snapshot.id === activeBenchmark.id} key={snapshot.id} onClick={() => setSelectedBenchmark(snapshot.id)} role="tab" type="button">{snapshot.label}</button>)}
      </div>
      <div className="llm-benchmark-visual">
        <div className="llm-benchmark-copy"><span>{activeBenchmark.dataAsOf} data</span><h2>{activeBenchmark.label} source attention</h2><p>Share of citations among the top sources in Ahrefs&apos; broad US query benchmark. A high market share does not mean every business should target that source.</p><small>Choose an actionable bar to open its checklist. Reference-only domains remain benchmark context.</small><a href={activeBenchmark.sourceUrl} rel="noreferrer" target="_blank">Read the current study ↗</a></div>
        <div className="llm-benchmark-bars">
          {activeBenchmark.domains.map((domain) => {
            const playbookKey = citationDomainPlaybookKey(domain.domain);
            const content = <><div><strong>{domain.label}</strong><span>{domain.share}%</span></div><i><b style={{ width: `${Math.max(5, (domain.share / benchmarkMax) * 100)}%` }} /></i><small>{playbookKey ? `Open ${progress.sources.find((source) => source.key === playbookKey)?.name ?? domain.label} playbook` : "Benchmark context only"}</small></>;
            return playbookKey
              ? <button aria-label={`Open ${domain.label} source playbook`} data-playbook-source={playbookKey} key={domain.domain} onClick={() => openBenchmarkPlaybook(playbookKey)} type="button">{content}</button>
              : <div className="reference-only" key={domain.domain}>{content}</div>;
          })}
        </div>
      </div>
      <p className="llm-benchmark-footnote">Benchmarks change by model, query set, industry, country, and month. Destiny uses them to prioritize possible ecosystems; your provider evidence below remains the source of truth for detected visibility.</p>
    </section>
  </div>;
}
