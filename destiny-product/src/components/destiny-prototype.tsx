"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { DestinyLogicInput, DestinyLogicResult, runDestinyLogic } from "@/lib/logicaffeine";
import type { SeoAuditResult } from "@/lib/seo/types";

type OnboardingField = "business" | "customer" | "competitors" | "standout";

type SpeechRecognitionEventLike = {
  results: { 0: { 0: { transcript: string } } };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type DestinyNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  destination_path: string | null;
  read_at: string | null;
  created_at: string;
};

const initialForm = {
  firstName: "",
  lastName: "",
  businessName: "",
  email: "",
  website: "",
  business: "",
  customer: "",
  competitors: "",
  standout: "",
};

const seededLogic: DestinyLogicResult = {
  growthStage: "fix_foundations",
  decisionCode: "fix_technical",
  weeklyQuest: "Fix the highest-impact technical issue",
  questCategory: "technical",
  urgency: "urgent",
  explanation: "Critical technical issues can block crawling ranking and conversions so the highest-impact issue comes first",
  keywordVerdict: "reject",
  keywordRuleId: "no_vocabulary_match",
  keywordReason: "No keyword candidate is being evaluated in this overview.",
  essentialKeyword: false,
  weeklyTaskCount: 3,
  contentTaskCount: 1,
  distributionTaskCount: 1,
  weeklyTaskManifest: ["vocabulary_review", "content_review", "primary_quest"],
};

const seededAudit: SeoAuditResult = {
  source: "demo",
  sourceLabel: "Demo audit data",
  domain: "example.com",
  fetchedAt: new Date(0).toISOString(),
  metrics: {
    criticalIssues: 3,
    warnings: 7,
    rankingKeywords: 7,
    newKeywords: 2,
    lostKeywords: 0,
    estimatedOrganicTraffic: 124,
    contentGaps: 8,
    reviewCount: 6,
    onPageScore: 72,
  },
  issues: [
    { code: "missing_title", label: "Missing or weak page titles", severity: "critical" },
    { code: "broken_links", label: "Broken internal links", severity: "critical" },
  ],
  competitors: [],
  keywords: [
    { keyword: "san francisco homes for families", rank: 18, searchVolume: 390, url: "https://example.com/", intent: "commercial", difficulty: 42, cpc: 3.8, opportunity: "existing_rank" },
  ],
  notices: ["This is deterministic demonstration data, not a live SEO measurement."],
};

const navigation = [
  { label: "Home", href: "/" },
  { label: "This week", href: "/this-week" },
  { label: "Overview", href: "/app" },
  { label: "Audits", href: "/audits" },
  { label: "Growth plan", href: "/growth-plan" },
  { label: "Content", href: "/content" },
  { label: "Distribution", href: "/distribution" },
  { label: "Reviews", href: "/reviews" },
  { label: "Analytics", href: "/analytics" },
  { label: "LLM visibility", href: "/llm-visibility" },
  { label: "Connections", href: "/integrations" },
];

const stageLabels: Record<string, string> = {
  audit_in_progress: "Audit in progress",
  fix_foundations: "Fix the foundations",
  build_search_coverage: "Build search coverage",
  compound_distribution: "Compound distribution",
};

type DestinyPrototypeProps = {
  hasWorkspace?: boolean;
  initialAudit?: SeoAuditResult;
  initialAuditFailure?: string;
  initialAuditId?: string;
  initialAuditStatus?: string;
  initialForm?: Partial<typeof initialForm>;
  initialLogic?: DestinyLogicResult;
  initialMomentum?: { completed: number; streak: number; perfectWeeks?: number };
  startOnboarding?: boolean;
};

export function DestinyPrototype({ hasWorkspace = false, initialAudit, initialAuditFailure, initialAuditId, initialAuditStatus, initialForm: savedForm, initialLogic, initialMomentum, startOnboarding = false }: DestinyPrototypeProps) {
  const [view, setView] = useState<"audit" | "onboarding" | "processing">(
    initialAuditStatus === "running" || initialAuditStatus === "failed"
      ? "processing"
      : startOnboarding || !hasWorkspace || !initialAudit
        ? "onboarding"
        : "audit",
  );
  const [form, setForm] = useState({ ...initialForm, ...savedForm });
  const [logic] = useState(initialLogic ?? seededLogic);
  const [audit] = useState(initialAudit ?? seededAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialAuditFailure ?? "");
  const [listening, setListening] = useState<OnboardingField | null>(null);
  const [auditId, setAuditId] = useState<string | null>(initialAuditId ?? null);
  const [auditStatus, setAuditStatus] = useState(initialAuditStatus ?? "complete");
  const [notifications, setNotifications] = useState<DestinyNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const opportunityKeyword = audit.keywords.find((keyword) => keyword.opportunity === "site_idea")?.keyword
    ?? audit.keywords.find((keyword) => keyword.opportunity === "competitor_gap")?.keyword
    ?? audit.keywords[0]?.keyword
    ?? `${audit.domain} services`;

  useEffect(() => {
    if (view !== "processing" || auditStatus !== "running" || !auditId) return;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/audits/${encodeURIComponent(auditId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as {
        audit?: { status?: string; failure_message?: string | null };
        verification?: { input: DestinyLogicInput; result: DestinyLogicResult | null; savedQuest: { title: string; category: string } } | null;
      };
      if (payload.audit?.status === "complete") {
        window.clearInterval(poll);
        if (!payload.verification?.result) {
          setAuditStatus("failed");
          setError("The audit finished without a complete LOGOS verification record.");
          return;
        }
        const browserLogic = await runDestinyLogic(payload.verification.input);
        const expected = payload.verification.result;
        const sameDecision = Object.entries(browserLogic).every(([key, value]) => expected[key as keyof DestinyLogicResult] === value);
        const savedQuestMatches = browserLogic.weeklyQuest === payload.verification.savedQuest.title
          && browserLogic.questCategory === payload.verification.savedQuest.category;
        if (!sameDecision || !savedQuestMatches) {
          setAuditStatus("failed");
          setError("Destiny’s browser and server rules did not agree. No inconsistent recommendation was shown.");
          return;
        }
        window.location.assign("/this-week");
      }
      if (payload.audit?.status === "failed") {
        setAuditStatus("failed");
        setError(payload.audit.failure_message || "Destiny could not complete this audit.");
      }
    }, 4000);
    return () => window.clearInterval(poll);
  }, [auditId, auditStatus, view]);

  const loadNotifications = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { notifications?: DestinyNotification[] };
    setNotifications(payload.notifications ?? []);
  };

  const openNotification = async (notification: DestinyNotification) => {
    if (!notification.read_at) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
    }
    if (notification.destination_path) window.location.assign(notification.destination_path);
    else await loadNotifications();
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const dictate = (field: OnboardingField) => {
    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setError("Voice input is not supported in this browser. Chrome is recommended.");
      return;
    }

    setError("");
    setListening(field);
    const recognition = new Constructor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      updateField(field, `${form[field]} ${transcript}`.trim());
    };
    recognition.onerror = () => {
      setError("Destiny could not hear you. Check Chrome's microphone permission and try again.");
    };
    recognition.onend = () => setListening(null);
    recognition.start();
  };

  const completeOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const onboardingResponse = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const onboardingPayload = await onboardingResponse.json() as { error?: string; websiteId?: string };
      if (!onboardingResponse.ok || !onboardingPayload.websiteId) {
        throw new Error(onboardingPayload.error || "Destiny could not save your business profile.");
      }

      setAuditStatus("running");
      setView("processing");
      const auditResponse = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: form.website,
          websiteId: onboardingPayload.websiteId,
          locationName: "United States",
        }),
      });
      const auditPayload = await auditResponse.json() as { auditId?: string; error?: string; status?: string };
      if (!auditResponse.ok || !auditPayload.auditId) {
        if (typeof auditPayload.auditId === "string") setAuditId(auditPayload.auditId);
        throw new Error(auditPayload.error || "Destiny could not run your audit.");
      }
      setAuditId(auditPayload.auditId);
      setAuditStatus("running");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destiny could not create your plan.");
      setAuditStatus("failed");
      setView("processing");
    } finally {
      setLoading(false);
    }
  };

  if (view === "processing") {
    const failed = auditStatus === "failed";
    return (
      <main className="processing-shell">
        <section className="processing-card">
          <div className="brand"><span className="brand-mark">D</span><span>Destiny</span></div>
          <div className={failed ? "processing-orb failed" : "processing-orb"}>{failed ? "!" : "D"}</div>
          <div className="eyebrow">{failed ? "Audit needs attention" : "Audit in progress"}</div>
          <h1>{failed ? "We couldn’t finish this audit." : `We’re building your strategy for ${form.website}.`}</h1>
          <p>{failed ? error : "Destiny is analyzing your website, competitors, keyword opportunities, and the first 12 weeks of your growth plan."}</p>
          {!failed && <div className="processing-steps"><span className="complete">Business profile saved</span><span className="active">Website and competitor analysis</span><span>Keyword strategy</span><span>LOGOS weekly quest</span></div>}
          {!failed && <div className="configuration-note"><strong>You can safely leave this page</strong><p>Your audit is saved. Destiny will add a notification and, once email is activated, send a link when the results are ready.</p></div>}
          {failed && <div className="processing-actions"><button className="primary-button" onClick={() => { setError(""); setView("onboarding"); }} type="button">Review and try again</button><Link className="secondary-button" href="/audits">View audit history</Link></div>}
        </section>
      </main>
    );
  }

  if (view === "onboarding") {
    return (
      <main className="onboarding-shell">
        <header className="onboarding-header">
          <button className="brand" onClick={() => { if (hasWorkspace && initialAudit) setView("audit"); else window.location.assign("/"); }} type="button">
            <span className="brand-mark">D</span><span>Destiny</span>
          </button>
          <span className="step-label">Business profile · Step 1 of 3</span>
        </header>

        <form className="onboarding-card" onSubmit={completeOnboarding}>
          <div className="eyebrow">Start a new growth journey</div>
          <h1>Tell Destiny about your business.</h1>
          <p className="lede">
            We’ll use this context to prepare your website audit, competitor research,
            keyword strategy, and three-month growth plan.
          </p>

          <div className="form-grid two-column">
            <label>First name<input autoComplete="given-name" placeholder="Maya" required value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} /></label>
            <label>Last name<input autoComplete="family-name" placeholder="Torres" required value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} /></label>
          </div>
          <label>Business name<input autoComplete="organization" placeholder="Maya Torres Realty" required value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} /></label>
          <div className="form-grid two-column">
            <label>Contact email<input autoComplete="email" placeholder="maya@yourbusiness.com" required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
            <label>Website<input autoComplete="url" placeholder="https://yourbusiness.com" required type="url" value={form.website} onChange={(event) => updateField("website", event.target.value)} /></label>
          </div>

          {([
            ["business", "Tell us about your business and the products or services you provide."],
            ["customer", "Tell us about your ideal customer."],
            ["competitors", "Who are your competitors? Add their names or website URLs."],
            ["standout", "What makes you stand out from competitors?"],
          ] as const).map(([field, label]) => (
            <label key={field}>
              <span className="label-row">
                <span>{label}</span>
                <button className={listening === field ? "voice-button listening" : "voice-button"} onClick={() => dictate(field)} type="button">
                  {listening === field ? "Listening…" : "◉ Talk instead"}
                </button>
              </span>
              <textarea
                placeholder={field === "business" ? "What do you sell, where do you work, and what problems do you solve?" : field === "customer" ? "Who do you most want to reach and what are they trying to accomplish?" : field === "competitors" ? "Add local competitor names or website URLs." : "Share your experience, point of view, proof, and what customers value about working with you."}
                required
                rows={3}
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
              />
            </label>
          ))}

          {error && <div className="error-banner">{error}</div>}
          <div className="form-actions">
            <button className="secondary-button" onClick={() => { if (hasWorkspace && initialAudit) setView("audit"); else window.location.assign("/"); }} type="button">{hasWorkspace && initialAudit ? "Back to dashboard" : "Back to home"}</button>
            <button className="primary-button" disabled={loading} type="submit">{loading ? "Creating your plan…" : "Start my audit"}</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand"><span className="brand-mark">D</span><span>Destiny</span></div>
        <nav>
          {navigation.map((item) => (
            <Link className={item.label === "Overview" ? "active" : ""} href={item.href} key={item.label}><span className="nav-dot" />{item.label}</Link>
          ))}
        </nav>
        <div className="sidebar-card"><span className="logic-pulse" /><strong>LOGOS rules active</strong><p>Destiny’s next-action rules are compiled by LOGICAFFEINE.</p></div>
        <form action="/auth/signout" method="post"><button className="sidebar-signout" type="submit">Sign out</button></form>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <span className="eyebrow">{form.businessName || `${form.firstName} ${form.lastName}`} · {audit.domain}</span>
            <h1>Your audit is ready.</h1>
            <p>Your evidence is ready. Go to This week for the exact checklist, time, and next action.</p>
            <div className={audit.source === "demo" ? "data-source demo" : "data-source live"}>
              <span />{audit.sourceLabel} · {audit.domain}
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-button" aria-expanded={notificationsOpen} aria-label="Notifications" onClick={() => { setNotificationsOpen((current) => !current); void loadNotifications(); }} type="button">●{notifications.filter((item) => !item.read_at).length > 0 && <span className="notification-count">{notifications.filter((item) => !item.read_at).length}</span>}</button>
            {notificationsOpen && (
              <div className="notification-panel">
                <div className="notification-panel-heading"><strong>Notifications</strong><span>{notifications.filter((item) => !item.read_at).length} unread</span></div>
                {notifications.length ? notifications.map((notification) => (
                  <button className={notification.read_at ? "notification-item" : "notification-item unread"} key={notification.id} onClick={() => void openNotification(notification)} type="button">
                    <span className="notification-dot" />
                    <span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                  </button>
                )) : <p className="empty-state notification-empty">Your audit updates will appear here.</p>}
              </div>
            )}
            <Link className="primary-button" href="/onboarding">Audit a new website</Link>
          </div>
        </header>

        <section className="hero-grid">
          <article className="quest-card">
            <div className="quest-topline"><span>Week 1 quest</span><span>Guided action</span></div>
            <div className="quest-icon">↗</div>
            <h2>{logic.weeklyQuest}</h2>
            <p>{logic.explanation}</p>
            <div className="quest-meta"><span>About 20 minutes</span><span>Destiny will guide you</span></div>
            <Link className="quest-link" href="/this-week">Start this week’s guided plan →</Link>
          </article>

          <article className="momentum-card">
            <div className="card-heading"><span>Your momentum</span><span className="status-chip">Audit complete</span></div>
            <div className="momentum-score"><strong>{initialMomentum?.streak ?? 0}</strong><span>week streak</span></div>
            <div className="week-row">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span className={index === 0 ? "today" : ""} key={`${day}-${index}`}>{day}</span>)}</div>
            <div className="momentum-stats"><span><strong>{initialMomentum?.completed ?? 0}</strong> tasks done</span><span><strong>{initialMomentum?.perfectWeeks ?? 0}</strong> Perfect Weeks</span></div>
            <div className="rule-result"><span>Current growth stage</span><strong>{stageLabels[logic.growthStage] ?? logic.growthStage}</strong><small>{logic.urgency} priority · {logic.questCategory} · selected by LOGOS</small></div>
          </article>
        </section>

        <section className="metrics-grid">
          {[
            [audit.metrics.criticalIssues.toLocaleString(), "Critical issues", `${audit.metrics.warnings} additional warnings`, "warning"],
            [audit.metrics.rankingKeywords.toLocaleString(), "Ranking keywords", `+${audit.metrics.newKeywords} new · ${audit.metrics.lostKeywords} lost`, "good"],
            [audit.metrics.contentGaps.toLocaleString(), "Content gaps", "Against the closest search competitor", "neutral"],
            [audit.metrics.reviewCount.toLocaleString(), "Google reviews", audit.source === "dataforseo" ? "Connect Google Business Profile" : "Goal: 10", "neutral"],
          ].map(([value, label, detail, tone]) => (
            <article className="metric-card" key={label}><div className={`metric-spark ${tone}`} /><strong>{value}</strong><span>{label}</span><small>{detail}</small></article>
          ))}
        </section>

        <section className="lower-grid">
          <article className="plan-card">
            <div className="card-heading"><div><span>Three-month growth plan</span><small>Your first 30 days are ready</small></div><Link href="/growth-plan">View plan →</Link></div>
            <div className="timeline">
              {[
                ["Month 1", "Fix foundations", "Technical cleanup + measurement"],
                ["Month 2", "Build search coverage", "Core service and use-case pages"],
                ["Month 3", "Build authority", "Guides, reviews, Reddit + Quora"],
              ].map(([month, title, detail], index) => (
                <div className={index === 0 ? "timeline-item current" : "timeline-item"} key={month}><span>{index + 1}</span><div><small>{month}</small><strong>{title}</strong><p>{detail}</p></div></div>
              ))}
            </div>
          </article>

          <article className="opportunity-card">
            <div className="card-heading"><span>Best opportunity</span><span className="status-chip amber">High impact</span></div>
            <h3>Create the next high-value page for your audience.</h3>
            <p>Focus keyword: <strong>{opportunityKeyword}</strong></p>
            <div className="opportunity-stats"><span><b>{Math.round(audit.metrics.estimatedOrganicTraffic).toLocaleString()}</b> estimated organic visits</span><span><b>{audit.metrics.onPageScore === null ? "—" : Math.round(audit.metrics.onPageScore)}</b> on-page score</span></div>
            <Link href="/content">Open content brief →</Link>
          </article>
        </section>
      </section>
    </main>
  );
}
