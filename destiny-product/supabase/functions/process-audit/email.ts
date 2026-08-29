import { reboundSeoSender } from "../_shared/email-sender.ts";

export type EmailDelivery = {
  status: "sent" | "skipped" | "failed";
  messageId?: string;
  reason?: string;
};

export function withEmailDelivery(rawPayload: unknown, delivery: EmailDelivery) {
  const raw = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? rawPayload as Record<string, unknown>
    : {};
  return { ...raw, emailDelivery: delivery };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<EmailDelivery> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [{ name: "product", value: "destiny" }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => ({})) as { id?: unknown; message?: unknown };
  if (!response.ok) {
    return {
      status: "failed",
      reason: typeof payload.message === "string" ? payload.message.slice(0, 300) : `Email provider returned HTTP ${response.status}.`,
    };
  }
  return { status: "sent", messageId: typeof payload.id === "string" ? payload.id : undefined };
}

export type AuditReadyEmailInput = {
  auditId: string;
  firstName: string;
  recipient: string;
  domain: string;
  weeklyQuest: string;
};

export async function sendAuditReadyEmail(input: AuditReadyEmailInput): Promise<EmailDelivery> {
  if (input.recipient.toLowerCase().endsWith("@example.invalid")) {
    return { status: "skipped", reason: "Non-deliverable QA address." };
  }
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = reboundSeoSender(Deno.env.get("DESTINY_FROM_EMAIL"));
  const siteUrl = Deno.env.get("DESTINY_SITE_URL")?.trim().replace(/\/$/, "");
  if (!apiKey || !from || !siteUrl) {
    return { status: "skipped", reason: "Transactional email secrets are not configured." };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.recipient)) {
    return { status: "skipped", reason: "The profile does not contain a valid contact email." };
  }

  const planUrl = `${siteUrl}/this-week`;
  const greeting = input.firstName.trim() ? `Hi ${escapeHtml(input.firstName.trim())},` : "Hi,";
  const domain = escapeHtml(input.domain);
  const quest = escapeHtml(input.weeklyQuest);

  return sendResendEmail({
    apiKey,
    from,
    to: input.recipient,
    subject: `Your Rebound SEO audit for ${input.domain} is ready`,
    idempotencyKey: `destiny-audit-ready-${input.auditId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#20302c"><p>${greeting}</p><h1 style="font-family:Georgia,serif;font-weight:500">Your Rebound SEO audit is ready.</h1><p>We analyzed <strong>${domain}</strong> and selected one clear action to begin improving your search visibility.</p><div style="background:#edf6f1;border-radius:14px;padding:20px;margin:24px 0"><small style="color:#275f4e;font-weight:700;text-transform:uppercase">Your first weekly quest</small><h2 style="margin:8px 0 0">${quest}</h2></div><p><a href="${escapeHtml(planUrl)}" style="background:#275f4e;color:white;border-radius:10px;display:inline-block;padding:13px 18px;text-decoration:none;font-weight:700">Open my week 1 plan</a></p><p style="color:#71807a;margin-top:32px">Rebound SEO turns SEO into one focused habit at a time.</p></div>`,
    text: `${input.firstName.trim() ? `Hi ${input.firstName.trim()},` : "Hi,"}\n\nYour Rebound SEO audit for ${input.domain} is ready.\n\nYour first weekly quest: ${input.weeklyQuest}\n\nOpen your week 1 plan: ${planUrl}\n\nRebound SEO turns SEO into one focused habit at a time.`,
  });
}

export async function sendAuditReadyEmailWithRetry(
  input: AuditReadyEmailInput,
  options: {
    attempts?: number;
    send?: (input: AuditReadyEmailInput) => Promise<EmailDelivery>;
    sleep?: (milliseconds: number) => Promise<unknown>;
  } = {},
): Promise<EmailDelivery> {
  const attempts = Math.max(1, Math.min(3, Math.round(options.attempts ?? 3)));
  const send = options.send ?? sendAuditReadyEmail;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastDelivery: EmailDelivery = { status: "failed", reason: "Email delivery did not start." };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      lastDelivery = await send(input);
    } catch (cause) {
      lastDelivery = {
        status: "failed",
        reason: cause instanceof Error ? cause.message.slice(0, 300) : "Email provider request failed.",
      };
    }
    if (lastDelivery.status === "sent" || lastDelivery.status === "skipped" || attempt === attempts) return lastDelivery;
    await sleep(500 * 2 ** (attempt - 1));
  }

  return lastDelivery;
}
