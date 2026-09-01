import { reboundSeoSender } from "../_shared/email-sender.ts";
import type { ProgressReportItem, ProgressReportSummary } from "./logic.ts";

export type ProgressReportEmailInput = {
  siteName: string;
  domain: string;
  progressUrl: string;
  recipient: string;
  requestId: string;
  websiteId: string;
  summary: ProgressReportSummary;
};

type SendDependencies = {
  env?: (name: string) => string | undefined;
  fetcher?: typeof fetch;
};

export type ProgressReportDelivery =
  | { status: "accepted"; messageId: string }
  | { status: "skipped" | "failed"; reason: string };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 180);
}

function dateLabel(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "Saved";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function htmlRows(items: ProgressReportItem[], empty: string, showEvidence = false) {
  if (!items.length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return items.slice(0, 20).map((item) => `<div class="row"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>${showEvidence ? `<span>${item.evidence === "verified" ? "Verified evidence" : "Reported complete"} · ${escapeHtml(dateLabel(item.at))}</span>` : ""}</div>`).join("");
}

function textRows(items: ProgressReportItem[], empty: string, showEvidence = false) {
  if (!items.length) return `- ${empty}`;
  return items.slice(0, 20).map((item) => `- ${item.title}: ${item.detail}${showEvidence ? ` · ${item.evidence === "verified" ? "Verified evidence" : "Reported complete"} · ${dateLabel(item.at)}` : ""}`).join("\n");
}

export function renderProgressReportEmail(input: ProgressReportEmailInput) {
  const { stats } = input.summary;
  const subject = `${safeHeader(input.siteName) || safeHeader(input.domain) || "Your website"} progress report · Rebound SEO`;
  const text = `${input.siteName} · ${input.domain}\n\nDONE ${stats.done} · NEEDS YOU ${stats.needsUser} · IN MOTION ${stats.inMotion} · STUCK ${stats.stuck}\n\nWHAT'S BEEN DONE\n${textRows(input.summary.done, "No completed saved moves yet.", true)}\n\nYOU\n${textRows(input.summary.owners.you, "Nothing waiting on you.")}\n\nREBOUND\n${textRows(input.summary.owners.rebound, "Nothing currently in motion.")}\n\nWAITING ON GOOGLE\n${textRows(input.summary.owners.google, "Nothing waiting on Google.")}\n\nWHAT'S STUCK\n${textRows(input.summary.blockers, "No saved blocker is active.")}\n\nOpen Progress: ${input.progressUrl}\n\nVerified evidence and reported completion are intentionally different in Rebound SEO.`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#ede7d7;color:#182720;font-family:Arial,Helvetica,sans-serif}.wrap{box-sizing:border-box;width:100%;padding:28px 10px}.email{max-width:620px;margin:auto;overflow:hidden;border:1px solid #cfdacb;border-radius:18px;background:#f6f2e8}.brand{padding:22px 28px;border-bottom:1px solid #cfdacb}.brand strong{font-family:Georgia,serif;font-size:24px;font-weight:500}.brand span{float:right;color:#42544a;font-size:11px}.hero{padding:26px 28px 20px}.hero h1{margin:0 0 8px;font-family:Georgia,serif;font-size:34px;font-weight:500}.hero p{margin:0;color:#42544a;line-height:1.5}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 28px 24px}.stat{padding:14px 10px;border:1px solid #cfdacb;border-radius:12px;background:#fbf8f1}.stat strong{display:block;font-family:Georgia,serif;font-size:26px}.stat span{color:#42544a;font-size:9px;font-weight:700}.section{padding:22px 28px;border-top:1px solid #cfdacb}.section h2{margin:0 0 12px;font-family:Georgia,serif;font-size:21px;font-weight:500}.section h3{margin:18px 0 7px;color:#1e4634;font-size:11px;text-transform:uppercase}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:11px 0;border-top:1px solid #e1e5dc}.row:first-of-type{border-top:0}.row strong{font-size:13px}.row p,.empty{margin:3px 0 0;color:#42544a;font-size:11px;line-height:1.45}.row span{color:#1e4634;font-size:9px;font-weight:700}.cta{display:inline-block;margin-top:18px;padding:10px 14px;border-radius:9px;background:#1e4634;color:#fff!important;font-size:12px;font-weight:700;text-decoration:none}.footer{padding:18px 28px 28px;color:#65746e;font-size:10px;line-height:1.6}@media(max-width:480px){.wrap{padding:0}.email{border-radius:0;border-left:0;border-right:0}.stats{grid-template-columns:1fr 1fr}.brand,.hero,.section,.footer{padding-left:20px;padding-right:20px}.row{grid-template-columns:1fr}.brand span{float:none;display:block;margin-top:4px}}
</style></head><body><div class="wrap"><main class="email"><div class="brand"><strong>Rebound SEO.</strong><span>Progress check-in</span></div><div class="hero"><h1>${escapeHtml(input.siteName)}</h1><p>${escapeHtml(input.domain)} · a truthful summary from saved workspace evidence.</p></div><div class="stats"><div class="stat"><strong>${stats.done}</strong><span>DONE</span></div><div class="stat"><strong>${stats.needsUser}</strong><span>NEEDS YOU</span></div><div class="stat"><strong>${stats.inMotion}</strong><span>IN MOTION</span></div><div class="stat"><strong>${stats.stuck}</strong><span>STUCK</span></div></div><section class="section"><h2>What's been done</h2>${htmlRows(input.summary.done, "No completed saved moves yet.", true)}</section><section class="section"><h2>What needs to be done</h2><h3>You</h3>${htmlRows(input.summary.owners.you, "Nothing waiting on you.")}<h3>Rebound</h3>${htmlRows(input.summary.owners.rebound, "Nothing currently in motion.")}<h3>Waiting on Google</h3>${htmlRows(input.summary.owners.google, "Nothing waiting on Google.")}</section><section class="section"><h2>What's stuck</h2>${htmlRows(input.summary.blockers, "No saved blocker is active.")}<a class="cta" href="${escapeHtml(input.progressUrl)}">Open Progress</a></section><div class="footer">Verified evidence and reported completion are intentionally different. Provider acceptance does not prove inbox delivery.</div></main></div></body></html>`;
  return { subject, html, text };
}

export async function sendProgressReport(input: ProgressReportEmailInput, dependencies: SendDependencies = {}): Promise<ProgressReportDelivery> {
  const env = dependencies.env ?? ((name: string) => Deno.env.get(name));
  const fetcher = dependencies.fetcher ?? fetch;
  if (input.recipient.toLowerCase().endsWith("@example.invalid")) return { status: "skipped", reason: "Non-deliverable QA address." };
  if (!/^\S+@\S+\.\S+$/.test(input.recipient)) return { status: "skipped", reason: "The selected website does not have a valid report email." };
  const apiKey = env("RESEND_API_KEY")?.trim();
  const from = reboundSeoSender(env("DESTINY_FROM_EMAIL"));
  if (!apiKey || !from) return { status: "skipped", reason: "Transactional email is not configured." };
  const email = renderProgressReportEmail(input);

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `rebound-progress-${input.websiteId}-${input.requestId}`,
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: "product", value: "destiny" }, { name: "message", value: "progress-report" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
    if (!response.ok) return { status: "failed", reason: typeof payload.message === "string" ? payload.message.slice(0, 300) : `Email provider returned HTTP ${response.status}.` };
    if (typeof payload.id !== "string" || !payload.id.trim()) return { status: "failed", reason: "Email provider did not return an acceptance id." };
    return { status: "accepted", messageId: payload.id };
  } catch (cause) {
    return { status: "failed", reason: cause instanceof Error ? cause.message.slice(0, 300) : "Email provider request failed." };
  }
}
