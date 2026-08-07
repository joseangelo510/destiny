"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AuditMomentumProcessing } from "./audit-momentum-processing";
import { CompassCompanion } from "./compass-companion";
import { onboardingValidationFromPolicy, stepOneValidationFacts, stepTwoValidationFacts } from "../lib/onboarding/validation";
import { appendCompetitorSuggestion, validateCompetitorEntries } from "../lib/onboarding/competitors";
import { ONBOARDING_SEARCH_COUNTRY } from "../lib/onboarding/market";
import {
  appendDictation,
  type DictationRecognition,
  type DictationSession,
  startDictationSession,
} from "../lib/onboarding/dictation";
import {
  DEFAULT_CELEBRATION_PREFERENCES,
  playDestinySound,
  readCelebrationPreferences,
  saveCelebrationPreferences,
  type CelebrationPreferences,
} from "../lib/product/celebrations";
import {
  ONBOARDING_MOMENTUM_STAGES,
  onboardingMomentumFromPolicy,
  type MomentumPolicy,
} from "../lib/product/momentum-journey";
import { runDestinyLogic } from "../lib/logicaffeine";

type VoiceField = "productsServices" | "problem" | "customer" | "competitors" | "standout";

type SpeechRecognitionConstructor = new () => DictationRecognition;

type CompetitorSuggestion = {
  domain: string;
  sharedKeywords: number;
  relation: "search_landscape";
};

const emptyForm = {
  website: "",
  businessName: "",
  productsServices: "",
  problem: "",
  customer: "",
  competitors: "",
  standout: "",
  firstName: "",
  lastName: "",
  email: "",
};

export function PublicOnboarding({ initialMomentumPolicy, initialEmail = "" }: { initialMomentumPolicy: MomentumPolicy; initialEmail?: string }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({ ...emptyForm, email: initialEmail.trim() }));
  const [listening, setListening] = useState<VoiceField | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auditStatus, setAuditStatus] = useState<"idle" | "running" | "failed">("idle");
  const [auditProgress, setAuditProgress] = useState(0);
  const [celebration, setCelebration] = useState("");
  const [celebrationPreferences, setCelebrationPreferences] = useState<CelebrationPreferences>(DEFAULT_CELEBRATION_PREFERENCES);
  const [celebrationsReady, setCelebrationsReady] = useState(false);
  const [competitorSuggestions, setCompetitorSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [competitorSuggestionsLoading, setCompetitorSuggestionsLoading] = useState(false);
  const [competitorSuggestionNotice, setCompetitorSuggestionNotice] = useState("");
  const dictationSessionRef = useRef<DictationSession | null>(null);
  const dictationFieldRef = useRef<VoiceField | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const stepOneFacts = useMemo(() => stepOneValidationFacts(form), [form]);
  const stepTwoFacts = useMemo(() => stepTwoValidationFacts(form), [form]);
  const competitorValidation = useMemo(() => validateCompetitorEntries(form.competitors), [form.competitors]);
  const [momentumPolicy, setMomentumPolicy] = useState(initialMomentumPolicy);
  const { stepOne, stepTwo } = useMemo(() => onboardingValidationFromPolicy(momentumPolicy, stepOneFacts), [momentumPolicy, stepOneFacts]);
  const onboardingJourney = useMemo(() => onboardingMomentumFromPolicy(momentumPolicy), [momentumPolicy]);
  const coachReaction = step === 1
    ? "Let’s start with what is already true about your business."
    : step === 2
    ? "Great start. Now let’s find the people who need you."
    : "That helps. We know who needs to find you—and why.";

  const stepReady = useMemo(() => {
    if (step === 1) return stepOne.ready && stepOneFacts.fieldCount === 5 && stepOneFacts.emailValid && stepOneFacts.urlValid;
    if (step === 2) return stepTwo.ready && stepTwoFacts.fieldCount === 3;
    return form.standout.trim().length > 0 && competitorValidation.ready;
  }, [competitorValidation.ready, form, step, stepOne.ready, stepOneFacts, stepTwo.ready, stepTwoFacts.fieldCount]);

  useEffect(() => {
    const saved = readCelebrationPreferences();
    document.documentElement.dataset.reducedCelebrations = String(saved.reduced);
    const hydrationTimer = window.setTimeout(() => {
      setCelebrationPreferences(saved);
      setCelebrationsReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void runDestinyLogic({
      auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0,
      newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
      momentumOnboardingStep: step,
      onboardingOneFields: stepOneFacts.fieldCount,
      onboardingEmailValid: Number(stepOneFacts.emailValid),
      onboardingUrlValid: Number(stepOneFacts.urlValid),
      onboardingTwoFields: stepTwoFacts.fieldCount,
    }).then((policy) => {
      if (!cancelled) setMomentumPolicy(policy);
    }).catch((error: unknown) => {
      console.error("logos_momentum_onboarding", { fallbacks: 0, wasm_errors: 1, error });
    });
    return () => { cancelled = true; };
  }, [step, stepOneFacts.emailValid, stepOneFacts.fieldCount, stepOneFacts.urlValid, stepTwoFacts.fieldCount]);

  useEffect(() => () => {
    dictationSessionRef.current?.stop();
    dictationSessionRef.current = null;
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(""), 2100);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  const finishDictation = () => {
    const session = dictationSessionRef.current;
    dictationSessionRef.current = null;
    dictationFieldRef.current = null;
    setListening(null);
    session?.stop();
  };

  const dictate = (field: VoiceField) => {
    if (dictationSessionRef.current) {
      const shouldStartAnotherField = dictationFieldRef.current !== field;
      finishDictation();
      if (!shouldStartAnotherField) return;
    }

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
    dictationFieldRef.current = field;
    dictationSessionRef.current = startDictationSession({
      recognition,
      onError: setError,
      onStop: () => {
        if (dictationFieldRef.current !== field) return;
        dictationSessionRef.current = null;
        dictationFieldRef.current = null;
        setListening(null);
      },
      onTranscript: (transcript) => {
        setForm((current) => ({ ...current, [field]: appendDictation(current[field], transcript) }));
      },
    });
  };

  const discoverCompetitors = async () => {
    setCompetitorSuggestionsLoading(true);
    setCompetitorSuggestionNotice("");
    try {
      const response = await fetch("/api/onboarding/competitors/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: form.website, locationName: ONBOARDING_SEARCH_COUNTRY }),
      });
      const payload = await response.json() as { suggestions?: CompetitorSuggestion[]; warning?: string };
      setCompetitorSuggestions(payload.suggestions ?? []);
      if (!payload.suggestions?.length) {
        setCompetitorSuggestionNotice("No reliable search neighbors were found yet. Add two competitors you know by name or URL.");
      }
    } catch {
      setCompetitorSuggestionNotice("Live competitor suggestions are unavailable right now. You can still add names or URLs yourself.");
    } finally {
      setCompetitorSuggestionsLoading(false);
    }
  };

  const nextStep = () => {
    if (!stepReady) return;
    finishDictation();
    setError("");
    if (step === 1 && stepOne.normalizedWebsite) {
      setForm((current) => ({ ...current, website: stepOne.normalizedWebsite ?? current.website }));
    }
    const completedStage = ONBOARDING_MOMENTUM_STAGES[step - 1];
    setStep((current) => Math.min(3, current + 1));
    if (step === 2) void discoverCompetitors();
    setCelebration(completedStage.celebration);
    void playDestinySound("task_complete");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 3 || !stepReady) return;
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
      setAuditProgress(0);
      const auditResponse = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: form.website,
          websiteId: onboardingPayload.websiteId,
          locationName: ONBOARDING_SEARCH_COUNTRY,
        }),
      });
      const auditPayload = await auditResponse.json() as { auditId?: string; error?: string; progress?: number };
      if (!auditResponse.ok || !auditPayload.auditId) {
        throw new Error(auditPayload.error || "Destiny could not run your audit.");
      }
      setAuditProgress(typeof auditPayload.progress === "number" ? auditPayload.progress : 10);
      window.location.assign(`/audits/${encodeURIComponent(auditPayload.auditId)}`);
    } catch (cause) {
      setAuditStatus("failed");
      setError(cause instanceof Error ? cause.message : "Destiny could not create your plan.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSound = () => {
    const next = { ...celebrationPreferences, muted: !celebrationPreferences.muted };
    setCelebrationPreferences(next);
    saveCelebrationPreferences(next);
  };

  if (auditStatus !== "idle") {
    return <AuditMomentumProcessing failureMessage={error} initialPolicy={momentumPolicy} initialProgress={auditProgress} initialStatus={auditStatus} onRetry={() => { setAuditStatus("idle"); setAuditProgress(0); setStep(3); }} website={form.website} />;
  }

  return (
    <main className="guided-onboarding-shell">
      <header className="guided-onboarding-header">
        <Link className="brand" href="/" aria-label="Return to Destiny home"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <span className="live-connection"><i />Live SEO data connected</span>
        <div className="guided-header-actions"><button aria-label={celebrationPreferences.muted ? "Turn Destiny sounds on" : "Mute Destiny sounds"} className="onboarding-sound-toggle" disabled={!celebrationsReady} onClick={toggleSound} type="button">{celebrationPreferences.muted ? "Sound off" : "♪ Sound on"}</button><button aria-label="Open notifications" className="guided-notification" title="Notifications become available after your audit starts" type="button">◇</button></div>
      </header>

      <div className="guided-onboarding-layout">
        <aside className="guided-onboarding-intro">
          <p className="eyebrow">Your guided SEO starting line</p>
          <h1>Build the momentum to be found.</h1>
          <p>You bring the business knowledge. Destiny turns it into the research, priorities, and weekly coaching an SEO agency would normally prepare.</p>
          <div className="onboarding-momentum-summary"><CompassCompanion ariaLabel={`${onboardingJourney.completedCount} of ${ONBOARDING_MOMENTUM_STAGES.length} onboarding building blocks complete`} compact completed={onboardingJourney.completedCount} total={ONBOARDING_MOMENTUM_STAGES.length} /><div><span>Your path</span><strong>{onboardingJourney.completedCount} of {ONBOARDING_MOMENTUM_STAGES.length} building blocks complete</strong><div aria-hidden="true" className="onboarding-momentum-track"><span style={{ width: `${onboardingJourney.percent}%` }} /></div></div></div>
          <ol aria-label="Onboarding journey" className="guided-stage-list">
            {onboardingJourney.stages.map((stage, index) => {
              const number = index + 1;
              return <li aria-current={stage.state === "active" ? "step" : undefined} className={stage.state} key={stage.id}><span>{stage.state === "complete" ? "✓" : number}</span><div><strong>{stage.title}</strong><small>{stage.description}</small>{stage.state === "active" && <em>Building now</em>}</div></li>;
            })}
          </ol>
          <div className="guided-evidence"><strong>Small steps. Real evidence. No SEO team required.</strong><p>Each answer makes the strategy more useful. After this path, Destiny handles the live research and shows you exactly what it is doing.</p></div>
        </aside>

        <form className="guided-onboarding-card" onSubmit={submit}>
          <span className="guided-step">Step {step} of 3</span>
          <div aria-live="polite" className="onboarding-coach-reaction"><span aria-hidden="true">⌁</span><p><small>Destiny, your SEO coach</small><strong>{coachReaction}</strong></p></div>

          {step === 1 && <>
            <h2>Tell us about your business</h2>
            <p className="lede">Start with your contact details and the public website Destiny should analyze. Every response is required.</p>
            <div className="form-grid two-column">
              <label>First name<input autoComplete="given-name" onChange={(event) => updateField("firstName", event.target.value)} placeholder="Maya" required value={form.firstName} /></label>
              <label>Last name<input autoComplete="family-name" onChange={(event) => updateField("lastName", event.target.value)} placeholder="Torres" required value={form.lastName} /></label>
            </div>
            <label>Audit and contact email<input autoComplete="email" onChange={(event) => updateField("email", event.target.value)} placeholder="maya@yourbusiness.com" required type="email" value={form.email} /><small>Pre-filled from the email you use to sign in. Change it only if Destiny should send welcome and audit-ready updates somewhere else. You can always find the same results in the notification center.</small></label>
            <label>Business name<input autoComplete="organization" onChange={(event) => updateField("businessName", event.target.value)} placeholder="Nike" required value={form.businessName} /></label>
            <label>Business website URL<input aria-describedby="website-help" autoComplete="url" inputMode="url" onChange={(event) => updateField("website", event.target.value)} placeholder="https://www.yourbusiness.com" required type="text" value={form.website} /><small id="website-help">Enter your business’s website address, such as https://www.yourbusiness.com; do not enter only your business name.</small></label>
          </>}

          {step === 2 && <>
            <h2>Customer &amp; market</h2>
            <VoiceTextarea field="productsServices" label="What do you sell?" listening={listening} onChange={(value) => updateField("productsServices", value)} onDictate={dictate} placeholder="Like: tax prep, monthly accounting, payroll, CFO services." supportText="List each product or service in plain words." value={form.productsServices} />
            <VoiceTextarea field="customer" label="Who are your customers?" listening={listening} onChange={(value) => updateField("customer", value)} onDictate={dictate} placeholder="Like: restaurants, contractors, ecommerce stores, law firms." supportText="You probably serve a few different types. List them." value={form.customer} />
            <VoiceTextarea field="problem" label="What problem do you fix?" listening={listening} onChange={(value) => updateField("problem", value)} onDictate={dictate} placeholder={"Like: 'behind on the books,' 'tax deadline coming,' 'can't tell if we're profitable.'"} supportText="What do customers want fixed, found, or made better when they come to you?" value={form.problem} />
          </>}

          {step === 3 && <>
            <h2>Who are your competitors?</h2>
            <p className="lede">Add at least two real competitors and explain what makes your business stand out. Every response is required. Destiny also discovers sites that compete for the same searches.</p>
            <section aria-live="polite" className="competitor-suggestions">
              <div><strong>Discovered in your search landscape</strong><small>These can include businesses, publishers, or marketplaces. Add only the companies you consider direct competitors.</small></div>
              {competitorSuggestionsLoading && <p>Finding organic search neighbors for {form.website}…</p>}
              {!competitorSuggestionsLoading && competitorSuggestions.length > 0 && <div className="competitor-suggestion-list">
                {competitorSuggestions.map((suggestion) => <button key={suggestion.domain} onClick={() => {
                  setForm((current) => ({ ...current, competitors: appendCompetitorSuggestion(current.competitors, suggestion.domain) }));
                  setCompetitorSuggestions((current) => current.filter((item) => item.domain !== suggestion.domain));
                }} type="button"><span>+ Add</span><strong>{suggestion.domain}</strong><small>{suggestion.sharedKeywords.toLocaleString()} shared keyword{suggestion.sharedKeywords === 1 ? "" : "s"}</small></button>)}
              </div>}
              {competitorSuggestionNotice && <p>{competitorSuggestionNotice}</p>}
            </section>
            <VoiceTextarea field="competitors" label="Known competitors" listening={listening} onChange={(value) => updateField("competitors", value)} onDictate={dictate} placeholder={"One competitor per line\nIvyWise — ivywise.com\nCollegewise — collegewise.com"} value={form.competitors} />
            {form.competitors.trim() && !competitorValidation.ready && <div aria-live="polite" className="field-error" role="alert">{competitorValidation.error}</div>}
            <VoiceTextarea field="standout" label="What makes you stand out from competitors?" listening={listening} onChange={(value) => updateField("standout", value)} onDictate={dictate} placeholder="Share your experience, point of view, proof, and what customers value about working with you." value={form.standout} />
          </>}

          {error && <div className="error-banner">{error}</div>}
          <div className="guided-actions">
            {step === 1 ? <Link className="secondary-button" href="/">Back to home</Link> : <button className="secondary-button" onClick={() => { setError(""); setStep((current) => current - 1); }} type="button">Back</button>}
            {step < 3 ? <button className="primary-button" disabled={!stepReady} onClick={nextStep} type="button">Continue</button> : <button className="primary-button" disabled={!stepReady || loading} type="submit">{loading ? "Starting analysis…" : "Run live analysis"}</button>}
          </div>
        </form>
      </div>
      {celebration && <div aria-live="polite" className="destiny-celebration"><span>⌁</span><strong>{celebration}</strong></div>}
    </main>
  );
}

function autosizeVoiceTextarea(textarea: HTMLTextAreaElement) {
  if (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content")) {
    textarea.style.height = "";
    textarea.style.overflowY = "auto";
    return;
  }
  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight) || Number.parseFloat(styles.fontSize) * 1.55;
  const chrome = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    + Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
  const maximumHeight = (lineHeight * 6) + chrome;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, maximumHeight)}px`;
  textarea.style.overflowY = textarea.scrollHeight > maximumHeight ? "auto" : "hidden";
}

function VoiceTextarea({ field, label, listening, onChange, onDictate, optional = false, placeholder, supportText, value }: {
  field: VoiceField;
  label: string;
  listening: VoiceField | null;
  onChange: (value: string) => void;
  onDictate: (field: VoiceField) => void;
  optional?: boolean;
  placeholder: string;
  supportText?: string;
  value: string;
}) {
  const active = listening === field;
  const inputId = `onboarding-${field}`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) autosizeVoiceTextarea(textareaRef.current);
  }, [value]);
  return <div className={active ? "voice-field listening" : "voice-field"}>
    <div className="label-row">
      <label htmlFor={inputId}>{label} {optional && <em>Optional</em>}</label>
      <button aria-label={`${active ? "Stop" : "Start"} dictation for ${label}`} aria-pressed={active} className={active ? "voice-button listening" : "voice-button"} onClick={() => onDictate(field)} type="button">
        <span aria-hidden="true" className="voice-button-icon">{active ? <><span className="voice-stop-icon" /><span className="voice-listening-bars"><i /><i /><i /></span></> : <svg className="voice-microphone-icon" viewBox="0 0 20 20"><rect height="10" rx="4" width="6" x="7" y="2" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" /></svg>}</span>
        <span>{active ? "Listening · tap to stop" : "Dictate"}</span>
      </button>
    </div>
    {supportText && <small className="voice-field-support">{supportText}</small>}
    <textarea id={inputId} onChange={(event) => onChange(event.target.value)} onInput={(event) => autosizeVoiceTextarea(event.currentTarget)} placeholder={placeholder} ref={textareaRef} required={!optional} rows={2} style={{ fieldSizing: "content" } as CSSProperties} value={value} />
    <small aria-live="polite" className="voice-dictation-help">{active ? "Listening now. Tap stop when you are done." : "Click to dictate. Tap again when done,"} Destiny will finish after 5 seconds of silence.</small>
  </div>;
}
