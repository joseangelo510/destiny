"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type VoiceField = "business" | "customer" | "competitors" | "standout";

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

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const emptyForm = {
  website: "",
  businessName: "",
  business: "",
  customer: "",
  localMarket: "",
  country: "United States",
  competitors: "",
  standout: "",
  firstName: "",
  lastName: "",
  email: "",
};

const countries = [
  "United States", "Canada", "United Kingdom", "Australia", "New Zealand", "Ireland",
  "France", "Germany", "Spain", "Italy", "Netherlands", "Belgium", "Sweden", "Norway",
  "Denmark", "Finland", "Singapore", "India", "Japan", "Brazil", "Mexico",
];

const onboardingStages = [
  ["Business & website", "What you offer"],
  ["Customer & market", "Who and where"],
  ["Known competitors", "Your competitive edge"],
  ["Review & analyze", "Launch live research"],
];

export function PublicOnboarding() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [listening, setListening] = useState<VoiceField | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [auditStatus, setAuditStatus] = useState<"idle" | "running" | "failed">("idle");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const stepReady = useMemo(() => {
    if (step === 1) return form.businessName.trim().length > 0 && /^https?:\/\//i.test(form.website.trim()) && form.business.trim().length > 0;
    if (step === 2) return form.customer.trim().length > 0 && form.country.length > 0;
    if (step === 3) return form.standout.trim().length > 0;
    return form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && /^\S+@\S+\.\S+$/.test(form.email.trim());
  }, [form, step]);

  useEffect(() => {
    if (auditStatus !== "running" || !auditId) return;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/audits/${encodeURIComponent(auditId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { audit?: { status?: string; failure_message?: string | null } };
      if (payload.audit?.status === "complete") {
        window.clearInterval(poll);
        window.location.assign("/app");
      }
      if (payload.audit?.status === "failed") {
        window.clearInterval(poll);
        setAuditStatus("failed");
        setError(payload.audit.failure_message || "Destiny could not complete this audit.");
      }
    }, 4000);
    return () => window.clearInterval(poll);
  }, [auditId, auditStatus]);

  const dictate = (field: VoiceField) => {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
      setForm((current) => ({ ...current, [field]: `${current[field]} ${transcript}`.trim() }));
    };
    recognition.onerror = () => setError("Destiny could not hear you. Allow microphone access in Chrome and try again.");
    recognition.onend = () => setListening(null);
    recognition.start();
  };

  const nextStep = () => {
    if (!stepReady) return;
    setError("");
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 4 || !stepReady) return;
    setLoading(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/anonymous", { method: "POST" });
      const sessionPayload = await sessionResponse.json() as { error?: string };
      if (!sessionResponse.ok) throw new Error(sessionPayload.error || "Destiny could not start your workspace.");

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
      const auditResponse = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website: form.website,
          websiteId: onboardingPayload.websiteId,
          locationName: form.country,
        }),
      });
      const auditPayload = await auditResponse.json() as { auditId?: string; error?: string };
      if (!auditResponse.ok || !auditPayload.auditId) {
        throw new Error(auditPayload.error || "Destiny could not run your audit.");
      }
      setAuditId(auditPayload.auditId);
    } catch (cause) {
      setAuditStatus("failed");
      setError(cause instanceof Error ? cause.message : "Destiny could not create your plan.");
    } finally {
      setLoading(false);
    }
  };

  if (auditStatus !== "idle") {
    const failed = auditStatus === "failed";
    return (
      <main className="processing-shell">
        <section className="processing-card">
          <Link className="brand" href="/"><span className="brand-mark">D</span><span>Destiny</span></Link>
          <div className={failed ? "processing-orb failed" : "processing-orb"}>{failed ? "!" : "D"}</div>
          <div className="eyebrow">{failed ? "Audit needs attention" : "Audit in progress"}</div>
          <h1>{failed ? "We couldn’t finish this audit." : `We’re building your strategy for ${form.website}.`}</h1>
          <p>{failed ? error : "Destiny is analyzing your website, competitors, keyword opportunities, technical issues, and the first 24 weeks of your growth plan."}</p>
          {!failed && <div className="processing-steps"><span className="complete">Business profile saved</span><span className="active">Website and competitor analysis</span><span>Keyword strategy</span><span>Six-month plan</span></div>}
          {!failed && <div className="configuration-note"><strong>You can safely leave this page</strong><p>Your notification center will save the progress and a link to the completed results.</p></div>}
          {failed && <div className="processing-actions"><button className="primary-button" onClick={() => { setAuditStatus("idle"); setStep(4); }} type="button">Review and try again</button><Link className="secondary-button" href="/">Back to home</Link></div>}
        </section>
      </main>
    );
  }

  return (
    <main className="guided-onboarding-shell">
      <header className="guided-onboarding-header">
        <Link className="brand" href="/" aria-label="Return to Destiny home"><span className="brand-mark">D</span><span>Destiny</span></Link>
        <span className="live-connection"><i />Live SEO data connected</span>
        <button aria-label="Open notifications" className="guided-notification" title="Notifications become available after your audit starts" type="button">◇</button>
      </header>

      <div className="guided-onboarding-layout">
        <aside className="guided-onboarding-intro">
          <p className="eyebrow">Live website analysis</p>
          <h1>Start with your real search landscape.</h1>
          <p>Destiny finds ranking keywords, organic competitors, technical issues, and mobile performance for any public website.</p>
          <ol className="guided-stage-list">
            {onboardingStages.map(([title, description], index) => {
              const number = index + 1;
              return <li className={number === step ? "active" : number < step ? "complete" : ""} key={title}><span>{number < step ? "✓" : number}</span><div><strong>{title}</strong><small>{description}</small></div></li>;
            })}
          </ol>
          <div className="guided-evidence"><strong>Live evidence, clearly labeled</strong><p>API credentials remain on the server. Provider metrics, recommendations, and example data stay separate.</p></div>
        </aside>

        <form className="guided-onboarding-card" onSubmit={submit}>
          <span className="guided-step">Step {step} of 4</span>

          {step === 1 && <>
            <h2>Tell us about your business</h2>
            <p className="lede">Use a public website and describe the products or services you provide.</p>
            <label>Business name<input autoComplete="organization" onChange={(event) => updateField("businessName", event.target.value)} placeholder="Nike" required value={form.businessName} /></label>
            <label>Website URL<input aria-describedby="website-help" autoComplete="url" onChange={(event) => updateField("website", event.target.value)} placeholder="https://yourwebsite.com" required type="url" value={form.website} /><small id="website-help">Any public website you are authorized to analyze</small></label>
            <VoiceTextarea field="business" label="Products and services" listening={listening} onChange={(value) => updateField("business", value)} onDictate={dictate} placeholder="Tell us what the business offers, where it operates, and what customers hire it to do." value={form.business} />
          </>}

          {step === 2 && <>
            <h2>Who is your ideal customer?</h2>
            <p className="lede">Local context shapes the strategy; the country selects the supported keyword database.</p>
            <VoiceTextarea field="customer" label="Ideal customer" listening={listening} onChange={(value) => updateField("customer", value)} onDictate={dictate} placeholder="Describe who they are, what they need, and what makes them ready to buy." value={form.customer} />
            <label>Local market <em>Optional</em><input onChange={(event) => updateField("localMarket", event.target.value)} placeholder="San Francisco, California" value={form.localMarket} /><small>Used as strategy context; not sent as a DataForSEO country.</small></label>
            <label>Search database country<select onChange={(event) => updateField("country", event.target.value)} value={form.country}>{countries.map((country) => <option key={country}>{country}</option>)}</select><small>DataForSEO Labs uses a supported country-level search database.</small></label>
          </>}

          {step === 3 && <>
            <h2>Who are your competitors?</h2>
            <p className="lede">Add names or website URLs if you know them. Destiny will also discover competitors from search overlap.</p>
            <VoiceTextarea field="competitors" label="Known competitors" listening={listening} onChange={(value) => updateField("competitors", value)} onDictate={dictate} optional placeholder={"One name or website per line\ncompetitor.com\nAnother local business"} value={form.competitors} />
            <VoiceTextarea field="standout" label="What makes you stand out from competitors?" listening={listening} onChange={(value) => updateField("standout", value)} onDictate={dictate} placeholder="Share your experience, point of view, proof, and what customers value about working with you." value={form.standout} />
          </>}

          {step === 4 && <>
            <h2>Ready to build your search baseline?</h2>
            <p className="lede">Tell us where to send your updates, review the details, then start a real analysis.</p>
            <div className="form-grid two-column">
              <label>First name<input autoComplete="given-name" onChange={(event) => updateField("firstName", event.target.value)} placeholder="Maya" required value={form.firstName} /></label>
              <label>Last name<input autoComplete="family-name" onChange={(event) => updateField("lastName", event.target.value)} placeholder="Torres" required value={form.lastName} /></label>
            </div>
            <label>Contact email<input autoComplete="email" onChange={(event) => updateField("email", event.target.value)} placeholder="maya@yourbusiness.com" required type="email" value={form.email} /><small>We’ll use this for your welcome and audit-ready updates. It is not an email verification gate.</small></label>
            <div className="guided-review-grid">
              <div><span>Business name</span><strong>{form.businessName}</strong></div>
              <div><span>Website</span><strong>{form.website}</strong></div>
              <div><span>Search database</span><strong>{form.country}</strong></div>
              <div><span>Business</span><p>{form.business}</p></div>
              <div><span>Ideal customer</span><p>{form.customer}</p></div>
              <div><span>Local market</span><strong>{form.localMarket || "Not specified"}</strong></div>
              <div><span>Known competitors</span><p>{form.competitors || "Let Destiny discover them from organic search overlap"}</p></div>
              <div className="wide"><span>What makes you stand out</span><p>{form.standout}</p></div>
            </div>
            <div className="guided-next"><strong>What happens next</strong><p>Destiny checks ranking keywords, keyword opportunities, measured organic competitors, crawl pages, and mobile performance. The notification center saves progress and completion updates.</p></div>
          </>}

          {error && <div className="error-banner">{error}</div>}
          <div className="guided-actions">
            {step === 1 ? <Link className="secondary-button" href="/">Back to home</Link> : <button className="secondary-button" onClick={() => { setError(""); setStep((current) => current - 1); }} type="button">Back</button>}
            {step < 4 ? <button className="primary-button" disabled={!stepReady} onClick={nextStep} type="button">Continue</button> : <button className="primary-button" disabled={!stepReady || loading} type="submit">{loading ? "Starting analysis…" : "Run live analysis"}</button>}
          </div>
        </form>
      </div>
    </main>
  );
}

function VoiceTextarea({ field, label, listening, onChange, onDictate, optional = false, placeholder, value }: {
  field: VoiceField;
  label: string;
  listening: VoiceField | null;
  onChange: (value: string) => void;
  onDictate: (field: VoiceField) => void;
  optional?: boolean;
  placeholder: string;
  value: string;
}) {
  return <label><span className="label-row"><span>{label} {optional && <em>Optional</em>}</span><button className={listening === field ? "voice-button listening" : "voice-button"} onClick={() => onDictate(field)} type="button">{listening === field ? "Listening…" : "◉ Talk instead"}</button></span><textarea onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={!optional} rows={4} value={value} /></label>;
}
