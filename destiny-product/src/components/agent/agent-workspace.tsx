"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import styles from "./agent-workspace.module.css";

type Conversation = { id: string; title: string; updatedAt: string };
type Message = { id: string; role: "user" | "assistant"; text: string; work?: string[] };
type Proposal = {
  id: string;
  status: "proposed" | "approved" | "rejected" | "failed";
  title: string;
  targetKeyword: string;
  angle: string;
  outlineBullets: string[];
  href?: string;
};

function parseEvent(chunk: string) {
  const data = chunk.split("\n").find((line) => line.startsWith("data: "));
  if (!data) return null;
  try {
    return JSON.parse(data.slice(6)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AgentWorkspace({
  conversations: initialConversations,
  initialMessages,
  initialProposals,
  selectedConversationId: initialConversationId,
  suggestedPrompts,
  website,
}: {
  conversations: Conversation[];
  initialMessages: Message[];
  initialProposals: Proposal[];
  selectedConversationId: string | null;
  suggestedPrompts: string[];
  website: { id: string; label: string; domain: string };
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [proposals, setProposals] = useState(initialProposals);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Ready");
  const [working, setWorking] = useState(false);
  const [decidingProposalId, setDecidingProposalId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const starters = useMemo(() => suggestedPrompts.slice(0, 3), [suggestedPrompts]);

  async function send(message: string) {
    const normalized = message.trim();
    if (!normalized || working) return;
    setError("");
    setWorking(true);
    setStatus("Sending");
    setInput("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: normalized }]);
    controller.current = new AbortController();
    let failureStatus = "";
    try {
      const response = await fetch("/api/agent/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ websiteId: website.id, conversationId, message: normalized }),
        signal: controller.current.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 429) failureStatus = "Rate limited";
        else if (response.status === 404 || response.status === 503) failureStatus = "Website not ready";
        throw new Error(payload.error || "Rebound Agent could not start this turn.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        buffer += decoder.decode(read.value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const event = parseEvent(chunk);
          if (!event || typeof event.type !== "string") continue;
          if (event.type === "status" && typeof event.message === "string") setStatus(event.message);
          if (event.type === "tool_start" && typeof event.name === "string") setStatus("Working: " + event.name.replaceAll("_", " "));
          if (event.type === "tool_end" && typeof event.summary === "string") {
            setMessages((current) => {
              const last = current.at(-1);
              if (last?.role === "assistant" && !last.text) {
                return [...current.slice(0, -1), { ...last, work: [...(last.work ?? []), event.summary as string] }];
              }
              return [...current, { id: crypto.randomUUID(), role: "assistant", text: "", work: [event.summary as string] }];
            });
          }
          if (event.type === "text" && typeof event.text === "string") {
            setMessages((current) => {
              const last = current.at(-1);
              if (last?.role === "assistant" && !last.text) return [...current.slice(0, -1), { ...last, text: event.text as string }];
              return [...current, { id: crypto.randomUUID(), role: "assistant", text: event.text as string }];
            });
          }
          if (event.type === "proposal" && event.proposal && typeof event.proposal === "object") {
            setProposals((current) => [...current, event.proposal as Proposal]);
            setStatus("Approval needed");
          }
          if (event.type === "done" && typeof event.conversationId === "string") {
            setConversationId(event.conversationId);
            setConversations((current) => current.some((item) => item.id === event.conversationId)
              ? current
              : [{ id: event.conversationId as string, title: normalized.slice(0, 72), updatedAt: new Date().toISOString() }, ...current]);
            window.history.replaceState({}, "", "/app/agent/" + event.conversationId + "?site=" + website.id);
            setStatus("Complete");
          }
          if (event.type === "error" && typeof event.message === "string") throw new Error(event.message);
        }
      }
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === "AbortError";
      setError(aborted ? "Turn stopped. Nothing was approved or created." : cause instanceof Error ? cause.message : "Rebound Agent could not finish.");
      setStatus(aborted ? "Stopped" : failureStatus || "Error");
    } finally {
      setWorking(false);
      controller.current = null;
    }
  }

  async function decide(proposal: Proposal, action: "approve" | "reject") {
    setError("");
    setDecidingProposalId(proposal.id);
    setStatus("Saving decision");
    try {
      const response = await fetch("/api/agent/proposals/" + proposal.id + "/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, websiteId: website.id }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; href?: string; status?: Proposal["status"] };
      if (!response.ok) {
        setError(payload.error || "The proposal decision could not be saved.");
        setStatus("Error");
        return;
      }
      const safeHref = typeof payload.href === "string" && payload.href.startsWith("/app/") && !payload.href.startsWith("//")
        ? payload.href
        : undefined;
      setProposals((current) => current.map((item) => item.id === proposal.id
        ? { ...item, href: safeHref, status: payload.status ?? (action === "approve" ? "approved" : "rejected") }
        : item));
      setStatus(action === "approve" ? "Draft created" : "Proposal rejected");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The proposal decision could not be saved.");
      setStatus("Error");
    } finally {
      setDecidingProposalId(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return <div className={styles.workspace}>
    <aside className={styles.threads}>
      <div><span>CONVERSATIONS</span><Link href={"/app/agent?site=" + website.id}>+ New</Link></div>
      {conversations.length ? conversations.map((conversation) => <Link
        aria-current={conversation.id === conversationId ? "page" : undefined}
        href={"/app/agent/" + conversation.id + "?site=" + website.id}
        key={conversation.id}
      >{conversation.title}</Link>) : <p>No conversations yet.</p>}
    </aside>
    <section className={styles.chat}>
      <header><div><span className={styles.orb} /> <b>Ask Rebound</b></div><small>{website.domain} · {status}</small></header>
      <div className={styles.messages} aria-live="polite">
        {!messages.length ? <div className={styles.empty}>
          <span className={styles.largeOrb} />
          <h2>What outcome do you want?</h2>
          <p>I can read your saved SEO evidence, explain the clearest move, and prepare a draft proposal for your approval.</p>
          <div>{starters.map((starter) => <button key={starter} onClick={() => void send(starter)} type="button">{starter}</button>)}</div>
        </div> : messages.map((message) => <article className={message.role === "user" ? styles.user : styles.assistant} key={message.id}>
          <strong>{message.role === "user" ? "You" : "Rebound"}</strong>
          {message.work?.length ? <details open={!message.text}><summary>Work completed</summary><ul>{message.work.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
          {message.text ? <p>{message.text}</p> : null}
        </article>)}
        {proposals.map((proposal) => <article className={styles.proposal} key={proposal.id}>
          <span>PERMISSION REQUIRED</span>
          <h3>{proposal.title}</h3>
          <p><b>{proposal.targetKeyword}</b> · {proposal.angle}</p>
          <ul>{proposal.outlineBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          {proposal.status === "proposed" ? <div><button disabled={decidingProposalId === proposal.id} onClick={() => void decide(proposal, "approve")} type="button">Create draft</button><button disabled={decidingProposalId === proposal.id} onClick={() => void decide(proposal, "reject")} type="button">Reject</button></div> : <strong>{proposal.status === "approved" ? proposal.href ? <Link href={proposal.href}>Draft created · open draft</Link> : "Draft created" : proposal.status === "rejected" ? "Rejected" : "Could not create draft"}</strong>}
        </article>)}
      </div>
      <form className={styles.composer} onSubmit={submit}>
        <span className={styles.composerLabel}>What outcome do you want?</span>
        <textarea aria-label="Message Rebound" maxLength={4_000} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your SEO, content, calendar, distribution, or progress…" rows={3} value={input} />
        <div><span>{error || "Rebound uses saved workspace evidence. Nothing publishes automatically."}</span>{working ? <button onClick={() => controller.current?.abort()} type="button">Stop</button> : <button disabled={!input.trim()} type="submit">Send</button>}</div>
      </form>
    </section>
  </div>;
}
