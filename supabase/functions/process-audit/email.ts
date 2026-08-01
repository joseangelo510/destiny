export type EmailDelivery = {
  status: "sent" | "skipped" | "failed";
  messageId?: string;
  reason?: string;
};

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

export async function sendAuditReadyEmail(input: {
  auditId: string;
  firstName: string;
  recipient: string;
  domain: string;
  weeklyQuest: string;
}): Promise<EmailDelivery> {
  if (input.recipient.toLowerCase().endsWith("@example.invalid")) {
    return { status: "skipped", reason: "Non-deliverable QA address." };
  }
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("DESTINY_FROM_EMAIL")?.trim();
  const siteUrl = Deno.env.get("DESTINY_SITE_URL")?.trim().replace(/\/$/, "");
  if (!apiKey || !from || !siteUrl) {
    return { status: "skipped", reason: "Transactional email secrets are not configured." };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.recipient)) {
    return { status: "skipped", reason: "The profile does not contain a valid contact email." };
  }

  const resultsUrl = `${siteUrl}/audits/${encodeURIComponent(input.auditId)}`;
  const greeting = input.firstName.trim() ? `Hi ${escapeHtml(input.firstName.trim())},` : "Hi,";
  const domain = escapeHtml(input.domain);
  const quest = escapeHtml(input.weeklyQuest);

  return sendResendEmail({
    apiKey,
    from,
    to: input.recipient,
    subject: `Your Destiny audit for ${input.domain} is ready`,
    idempotencyKey: `destiny-audit-ready-${input.auditId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#20302c"><p>${greeting}</p><h1 style="font-family:Georgia,serif;font-weight:500">Your Destiny audit is ready.</h1><p>We analyzed <strong>${domain}</strong> and selected one clear action to begin improving your search visibility.</p><div style="background:#edf6f1;border-radius:14px;padding:20px;margin:24px 0"><small style="color:#275f4e;font-weight:700;text-transform:uppercase">Your first weekly quest</small><h2 style="margin:8px 0 0">${quest}</h2></div><p><a href="${escapeHtml(resultsUrl)}" style="background:#275f4e;color:white;border-radius:10px;display:inline-block;padding:13px 18px;text-decoration:none;font-weight:700">View my audit results</a></p><p style="color:#71807a;margin-top:32px">Destiny turns SEO into one focused habit at a time.</p></div>`,
    text: `${input.firstName.trim() ? `Hi ${input.firstName.trim()},` : "Hi,"}\n\nYour Destiny audit for ${input.domain} is ready.\n\nYour first weekly quest: ${input.weeklyQuest}\n\nView your results: ${resultsUrl}\n\nDestiny turns SEO into one focused habit at a time.`,
  });
}
