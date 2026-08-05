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

const SIGNAL_SOURCES: ReadonlyArray<{
  key: LlmSourceKey;
  label: string;
  icon: string;
  benchmark: number;
}> = [
  { key: "reddit", label: "Reddit", icon: "◉", benchmark: 40.1 },
  { key: "wikipedia", label: "Wikipedia", icon: "▤", benchmark: 26.3 },
  { key: "youtube", label: "YouTube", icon: "▻", benchmark: 23.5 },
  { key: "owned-site", label: "Google", icon: "G", benchmark: 23.3 },
  { key: "reviews", label: "Yelp", icon: "☆", benchmark: 21 },
  { key: "linkedin", label: "LinkedIn", icon: "in", benchmark: 5.9 },
  { key: "quora", label: "Quora", icon: "Q", benchmark: 4.6 },
];

function upsertRecord(records: LlmVisibilityTaskRecord[], record: LlmVisibilityTaskRecord) {
  return [
    ...records.filter((candidate) => candidate.source_key !== record.source_key || candidate.task_key !== record.task_key),
    record,
  ];
}

function benchmarkStyle(benchmark: number) {
  return { "--benchmark-width": `${Math.round((benchmark / 40.1) * 1000) / 10}%` } as CSSProperties;
}

export function LlmSignalPlayboard({
  websiteId,
  initialRecords,
  initialProgress,
  llmVisibility,
}: {
  websiteId: string;
  initialRecords: LlmVisibilityTaskRecord[];
  initialProgress: Awaited<ReturnType<typeof buildLlmSourceProgress>>;
  llmVisibility: LlmVisibilitySignal;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [progress, setProgress] = useState(initialProgress);

  useEffect(() => {
    let cancelled = false;
    void buildLlmSourceProgress({ records, llmVisibility }).then((next) => {
      if (!cancelled) setProgress(next);
    });
    return () => { cancelled = true; };
  }, [records, llmVisibility]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`llm-signal-playboard:${websiteId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "llm_visibility_tasks",
        filter: `website_id=eq.${websiteId}`,
      }, (payload) => {
        if (payload.eventType !== "DELETE") {
          setRecords((current) => upsertRecord(current, payload.new as LlmVisibilityTaskRecord));
        }
      })
      .subscribe();
    const browserChannel = "BroadcastChannel" in window
      ? new window.BroadcastChannel(`destiny:llm-visibility:${websiteId}`)
      : null;
    if (browserChannel) {
      browserChannel.onmessage = (event) => {
        const message = event.data as { websiteId?: unknown; task?: LlmVisibilityTaskRecord } | null;
        if (message?.websiteId === websiteId && message.task?.source_key && message.task.task_key) {
          setRecords((current) => upsertRecord(current, message.task!));
        }
      };
    }
    return () => {
      browserChannel?.close();
      void supabase.removeChannel(channel);
    };
  }, [websiteId]);

  const openSource = (sourceKey: LlmSourceKey) => {
    window.dispatchEvent(new CustomEvent("destiny:open-llm-source", { detail: { sourceKey } }));
  };
  const streak = records.filter((record) => record.status === "complete").length;

  return <section className="llm-signal-playboard" aria-labelledby="llm-playboard-title">
    <header className="llm-playboard-header">
      <div>
        <h2 id="llm-playboard-title">AI visibility playboard</h2>
        <p>Ghost bars show how often AI cites each source. Your color shows your readiness.</p>
      </div>
      <div className="llm-playboard-streak" aria-label={`${streak} completed actions`}><span>Actions</span><strong><i>♨</i>{streak}</strong></div>
    </header>

    <div className="llm-playboard-legend" aria-label="Playboard legend">
      <span><i className="readiness" />Your readiness</span>
      <span><i className="benchmark" />AI citation benchmark</span>
      <span><i className="verified">♙</i>Verified AI citation</span>
    </div>

    <div className="llm-compact-source-list" aria-label="AI visibility source benchmarks">
      {SIGNAL_SOURCES.map((config) => {
        const source = progress.sources.find((candidate) => candidate.key === config.key);
        if (!source) return null;
        return <button
          className="llm-compact-source-row"
          data-signal-source={config.key}
          key={config.key}
          onClick={() => openSource(config.key)}
          style={benchmarkStyle(config.benchmark)}
          type="button"
        >
          <span className="llm-compact-source-line">
            <span className="llm-compact-source-name"><i>{config.icon}</i><strong>{config.label}</strong></span>
            <span className="llm-compact-source-stat">You <strong>{source.percent}%</strong> · Benchmark {config.benchmark}%</span>
          </span>
          <span className="llm-compact-benchmark"><i><b style={{ width: `${source.percent}%` }} /></i></span>
        </button>;
      })}
    </div>
    <p className="llm-playboard-footnote">Select a source to open its detailed playbook above. Benchmarks are market context—not proof that your business is cited.</p>
  </section>;
}
