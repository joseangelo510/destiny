"use client";

import { useMemo, useState } from "react";
import type { InterviewQuestion, InterviewTopic } from "@/lib/interviews/interviews";
import { validateInterviewAnswer } from "@/lib/interviews/interviews";
import styles from "./interviews-workspace.module.css";

export type InterviewHistoryView = {
  id: string;
  topicTitle: string;
  focusKeyword: string;
  status: string;
  completedAt: string | null;
  answerCount: number;
};

export type VoiceLibraryItemView = {
  id: string;
  interviewId: string;
  answerId: string;
  type: string;
  title: string;
  body: string;
  status: string;
  sourceText: string;
};

type ActiveInterview = {
  id: string;
  topicTitle: string;
  focusKeyword: string;
  questions: Array<InterviewQuestion & { id: string }>;
};

type CompletedInterview = {
  answers: Array<{ id: string; question: string; verbatimText: string }>;
  libraryItems: VoiceLibraryItemView[];
};

const stages = [
  ["topics", "1", "Pick a topic"],
  ["interview", "2", "The interview"],
  ["review", "3", "What we captured"],
  ["library", "4", "Voice Library"],
  ["article", "5", "Your article"],
] as const;

const insightLabels: Record<string, string> = {
  pov: "Point of view",
  story: "Story",
  evidence: "Your number",
  audience_pain: "Customer worry",
  product_note: "How you help",
  voice_marker: "How you sound",
  theme: "Theme",
};

function formatVolume(volume: number) {
  return volume > 0 ? `${new Intl.NumberFormat("en-US").format(volume)} searches/mo` : "Search volume not verified";
}

function parseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") return payload.error;
  return fallback;
}

export function InterviewsWorkspace({
  websiteId,
  auditId,
  businessName,
  generationAvailable,
  topics,
  previousInterviews,
  libraryItems,
}: {
  websiteId: string;
  auditId: string | null;
  businessName: string;
  generationAvailable: boolean;
  topics: InterviewTopic[];
  previousInterviews: InterviewHistoryView[];
  libraryItems: VoiceLibraryItemView[];
}) {
  const [stage, setStage] = useState<(typeof stages)[number][0]>("topics");
  const [activeInterview, setActiveInterview] = useState<ActiveInterview | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [completed, setCompleted] = useState<CompletedInterview | null>(null);
  const [items, setItems] = useState(libraryItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nudge, setNudge] = useState("");
  const [sourceOpen, setSourceOpen] = useState<Record<string, boolean>>({});
  const [customTopic, setCustomTopic] = useState("");

  const currentQuestion = activeInterview?.questions[questionIndex] ?? null;
  const progress = activeInterview ? Math.round(((questionIndex + 1) / activeInterview.questions.length) * 100) : 0;
  const hasLibrary = items.length > 0 || previousInterviews.length > 0;
  const confirmedCount = useMemo(() => items.filter((item) => item.status === "confirmed_by_owner").length, [items]);

  async function startInterview(topic: InterviewTopic) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, auditId, topic }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.interview) throw new Error(parseError(payload, "Destiny could not start this interview."));
      setActiveInterview(payload.interview as ActiveInterview);
      setQuestionIndex(0);
      setAnswer("");
      setNudge("");
      setStage("interview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not start this interview.");
    } finally {
      setBusy(false);
    }
  }

  async function startCustomInterview() {
    const title = customTopic.trim();
    if (!title) {
      setError("Add the topic you want Destiny to interview you about.");
      return;
    }
    await startInterview({
      title,
      angle: `Capture ${businessName}'s firsthand point of view.`,
      whyNow: "Suggested by you.",
      focusKeyword: title,
      searchVolume: 0,
      estimatedMinutes: 10,
      questionCount: 7,
    });
  }

  async function saveCurrentAnswer(skip = false) {
    if (!activeInterview || !currentQuestion) return;
    const validation = validateInterviewAnswer(answer);
    if (!skip && !validation.valid) {
      setError("Answer the question or choose Skip this question.");
      return;
    }
    if (!skip && validation.nudge && !nudge) {
      setNudge(validation.nudge);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/interviews/${activeInterview.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, answer, skip }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseError(payload, "Destiny could not save that answer."));
      if (questionIndex < activeInterview.questions.length - 1) {
        setQuestionIndex((index) => index + 1);
        setAnswer("");
        setNudge("");
        return;
      }
      const completionResponse = await fetch(`/api/interviews/${activeInterview.id}/complete`, { method: "POST" });
      const completionPayload = await completionResponse.json().catch(() => ({}));
      if (!completionResponse.ok || !completionPayload.interview) throw new Error(parseError(completionPayload, "Destiny saved your answers but could not finish the interview."));
      setCompleted(completionPayload.interview as CompletedInterview);
      setItems((current) => [...(completionPayload.interview.libraryItems as VoiceLibraryItemView[]), ...current]);
      setStage("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not save that answer.");
    } finally {
      setBusy(false);
    }
  }

  async function decideInsight(item: VoiceLibraryItemView, decision: "confirmed_by_owner" | "rejected_by_owner") {
    if (!activeInterview) return;
    const previous = items;
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: decision } : candidate));
    try {
      const response = await fetch(`/api/interviews/${activeInterview.id}/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, status: decision }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(parseError(payload, "Destiny could not save that decision."));
    } catch (cause) {
      setItems(previous);
      setError(cause instanceof Error ? cause.message : "Destiny could not save that decision.");
    }
  }

  async function createArticle() {
    if (!activeInterview) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/interviews/${activeInterview.id}/article`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.contentUrl !== "string") throw new Error(parseError(payload, "Destiny could not prepare the article draft."));
      window.location.assign(payload.contentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not prepare the article draft.");
      setBusy(false);
    }
  }

  function navigate(next: (typeof stages)[number][0]) {
    if (next === "interview" && !activeInterview) return setStage("topics");
    if ((next === "review" || next === "article") && !completed) return setStage("topics");
    setStage(next);
  }

  return <div className={styles.workspace}>
    <section className={styles.promise}>
      <div><span>NEW · DESTINY INTERVIEWS</span><h2>Talk for ten minutes about what you know.</h2></div>
      <p>Destiny turns the conversation into an article in your own words—and every interview makes future content sound more like you and less like generic AI.</p>
    </section>

    <nav aria-label="Interview progress" className={styles.stageNav}>
      {stages.map(([id, number, label]) => <button aria-current={stage === id ? "step" : undefined} className={stage === id ? styles.activeStage : ""} key={id} onClick={() => navigate(id)} type="button"><span>{number}</span>{label}</button>)}
    </nav>

    {error && <div aria-live="polite" className={styles.error} role="alert">{error}</div>}

    {stage === "topics" && <section className={styles.view}>
      <div className={styles.viewHeading}><span>Destiny has the questions</span><h2>Ready to be interviewed?</h2><p>Choose a topic based on your approved keywords and business context. Destiny asks one clear question at a time.</p></div>
      <div className={styles.trustNote}><span>🔒</span><p><strong>Your answers are saved word-for-word.</strong> Your first interview will start your Voice Library, and Destiny will never invent your experience.</p></div>
      <div className={styles.topicGrid}>{topics.map((topic) => <article className={styles.topicCard} key={`${topic.focusKeyword}-${topic.title}`}>
        <small>Suggested for you</small><h3>{topic.title}</h3><p>{topic.angle}</p>
        <div className={styles.topicReason}>{topic.whyNow}</div>
        <div className={styles.topicMeta}><span>{topic.focusKeyword}</span><span>{formatVolume(topic.searchVolume)}</span><span>About {topic.estimatedMinutes} min</span><span>{topic.questionCount} questions</span></div>
        <button className={styles.primaryButton} disabled={busy} onClick={() => startInterview(topic)} type="button">Start this interview →</button>
      </article>)}</div>
      <div className={styles.customTopic}><div><strong>Have your own idea?</strong><p>Tell Destiny the subject and it will build the same expert interview around it.</p></div><input aria-label="Custom interview topic" onChange={(event) => setCustomTopic(event.target.value)} placeholder="Example: Why I stopped recommending one common roofing material" value={customTopic} /><button disabled={busy} onClick={startCustomInterview} type="button">Build my interview</button></div>
      <div className={styles.answerModes}><div><strong>Type your answers</strong><span>Available now</span><p>Write as if you were explaining it to a customer.</p></div><div><strong>Tap to dictate</strong><span>Coming next</span><p>Audio recordings delete after 30 days; transcripts stay in your Voice Library.</p></div><div><strong>Live conversation</strong><span>Coming next</span><p>Destiny will ask and respond out loud after typed interviews are proven.</p></div></div>
    </section>}

    {stage === "interview" && activeInterview && currentQuestion && <section className={styles.view}>
      <div className={styles.interviewHeader}><div><span>{activeInterview.topicTitle}</span><strong>Question {questionIndex + 1} of {activeInterview.questions.length}</strong></div><div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div></div>
      <div className={styles.interviewGrid}><article className={styles.questionCard}><small>{currentQuestion.kind.replaceAll("_", " ")}</small><h2>{currentQuestion.text}</h2><p>Answer the way you would talk to a customer. Stories, real numbers, and strong opinions are especially useful.</p><textarea aria-label="Your interview answer" autoFocus onChange={(event) => { setAnswer(event.target.value); setNudge(""); }} placeholder="Talk it out in writing—Destiny will handle the polish later." rows={9} value={answer} />
        {nudge && <div className={styles.nudge}><strong>You have the idea.</strong> {nudge}<button onClick={() => { setNudge("ready"); void saveCurrentAnswer(false); }} type="button">Continue with this answer</button></div>}
        <div className={styles.questionActions}><button className={styles.primaryButton} disabled={busy} onClick={() => saveCurrentAnswer(false)} type="button">{busy ? "Saving…" : questionIndex === activeInterview.questions.length - 1 ? "Save answer & finish" : "Save answer & continue →"}</button><button disabled={busy} onClick={() => saveCurrentAnswer(true)} type="button">Skip this question</button></div>
        <div className={styles.trustNote}><span>🔒</span><p><strong>Your exact words are saved word-for-word—never rewritten.</strong> Cleanup happens only in the article draft. You can remove an answer later.</p></div>
      </article><aside className={styles.coachPanel}><span>DESTINY IS LISTENING FOR</span><h3>Your judgment, not perfect writing</h3><ul><li>A strong opinion</li><li>A real customer story</li><li>A number from your experience</li><li>What competitors get wrong</li><li>Why your approach is different</li></ul><p>Answers save after every question. If you leave, this interview remains available for 30 days.</p></aside></div>
    </section>}

    {stage === "review" && completed && <section className={styles.view}>
      <div className={styles.viewHeading}><span>Interview complete</span><h2>Here is what Destiny captured.</h2><p>Your exact words stay separate from Destiny’s interpretation. Confirming an insight teaches your Voice Library; rejecting it prevents reuse.</p></div>
      <div className={styles.captureGrid}><section><div className={styles.sectionHeading}><h3>Your words</h3><span>Verbatim · never edited</span></div>{completed.answers.map((entry, index) => <article className={styles.answerCard} key={entry.id}><small>Question {index + 1}</small><strong>{entry.question}</strong><blockquote>{entry.verbatimText}</blockquote></article>)}</section><section><div className={styles.sectionHeading}><h3>Destiny’s read</h3><span>AI interpretation · check it</span></div>{completed.libraryItems.length ? completed.libraryItems.map((item) => <article className={`${styles.insightCard} ${item.status === "rejected_by_owner" ? styles.rejected : ""}`} key={item.id}><small>{insightLabels[item.type] ?? item.type}</small><h4>{item.title}</h4><p>{item.body}</p><button onClick={() => setSourceOpen((current) => ({ ...current, [item.id]: !current[item.id] }))} type="button">{sourceOpen[item.id] ? "Hide my exact words" : "See exactly what I said"}</button>{sourceOpen[item.id] && <blockquote>{item.sourceText}</blockquote>}<div><button className={item.status === "confirmed_by_owner" ? styles.confirmed : ""} onClick={() => decideInsight(item, "confirmed_by_owner")} type="button">✓ That’s right</button><button className={item.status === "rejected_by_owner" ? styles.rejectedButton : ""} onClick={() => decideInsight(item, "rejected_by_owner")} type="button">✕ Not quite</button></div></article>) : <div className={styles.emptyPanel}>Your exact answers are safely stored. Destiny did not create interpretations from this interview.</div>}</section></div>
      <div className={styles.reviewFooter}><div><strong>{completed.answers.length} exact answers added to your Voice Library.</strong><p>Nothing is published. The article goes to Content Studio for your review.</p></div><button className={styles.secondaryButton} onClick={() => setStage("library")} type="button">See my Voice Library</button><button className={styles.primaryButton} disabled={busy || !generationAvailable || !auditId} onClick={createArticle} type="button">{busy ? "Preparing…" : "Write my article from this →"}</button></div>
      {!generationAvailable && <p className={styles.configurationNote}>Article generation is unavailable until Destiny’s server-side writing connection is configured. Your interview and transcript are already saved.</p>}
      {!auditId && <p className={styles.configurationNote}>Complete the website audit before creating the SEO article. Your interview and transcript are already saved.</p>}
    </section>}

    {stage === "library" && <section className={styles.view}>
      <div className={styles.libraryHero}><div><span>VOICE LIBRARY</span><h2>Everything Destiny has learned from your words.</h2><p>One website. One expert voice. Every confirmed interview makes future Content Studio drafts sound more like you.</p></div><div><strong>{items.length}</strong><span>captured insights</span><strong>{confirmedCount}</strong><span>confirmed by you</span></div></div>
      {!hasLibrary ? <div className={styles.emptyLibrary}><span>✦</span><h3>Your first interview will start your Voice Library.</h3><p>There is no invented sample data here. Choose one topic and share what you know.</p><button className={styles.primaryButton} onClick={() => setStage("topics")} type="button">Choose my first topic</button></div> : <div className={styles.libraryGrid}>{items.filter((item) => item.status !== "rejected_by_owner").map((item) => <article key={item.id}><small>{insightLabels[item.type] ?? item.type}</small><h3>{item.title}</h3><p>{item.body}</p><span>{item.status === "confirmed_by_owner" ? "Confirmed by you" : "Ready for your review"}</span></article>)}{previousInterviews.map((interview) => <article key={interview.id}><small>Interview</small><h3>{interview.topicTitle}</h3><p>{interview.answerCount} exact answers saved for this website.</p><span>{interview.status === "complete" ? "Complete" : "Continue later"}</span></article>)}</div>}
      <button className={styles.secondaryButton} onClick={() => setStage("topics")} type="button">Do another interview</button>
    </section>}

    {stage === "article" && completed && <section className={styles.view}><div className={styles.articleHandoff}><span>YOUR ARTICLE</span><h2>Turn this expertise into a sourced Content Studio draft.</h2><p>Destiny will use this interview, your confirmed Voice Library, approved keyword, current research, and verified internal pages. Direct quotes stay exact; Destiny-added claims must earn their own evidence.</p><div><span>{completed.answers.length} firsthand answers</span><span>{confirmedCount} confirmed insights</span><span>Human review required</span></div><button className={styles.primaryButton} disabled={busy || !generationAvailable || !auditId} onClick={createArticle} type="button">{busy ? "Preparing article…" : "Prepare my article in Content Studio →"}</button></div></section>}
  </div>;
}
