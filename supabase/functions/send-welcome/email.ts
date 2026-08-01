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

export async function sendWelcomeEmail(input: {
  userId: string;
  websiteId: string;
  firstName: string;
  recipient: string;
  domain: string;
}): Promise<EmailDelivery> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const from = Deno.env.get("DESTINY_FROM_EMAIL")?.trim();
  if (!apiKey || !from) {
    return { status: "skipped", reason: "Transactional email secrets are not configured." };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.recipient)) {
    return { status: "skipped", reason: "The profile does not contain a valid contact email." };
  }

  const greeting = input.firstName.trim() ? `Hi ${escapeHtml(input.firstName.trim())},` : "Hi,";
  const domain = escapeHtml(input.domain);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `destiny-welcome-${input.userId}-${input.websiteId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.recipient],
      subject: "Welcome to your Destiny",
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#20302c"><p>${greeting}</p><h1 style="font-family:Georgia,serif;font-weight:500">Welcome to your Destiny.</h1><p>Your profile for <strong>${domain}</strong> is complete. We are preparing your website audit, competitor research, keyword strategy, and first weekly quest.</p><div style="background:#edf6f1;border-radius:14px;padding:20px;margin:24px 0"><strong>What happens next</strong><p style="margin-bottom:0">Destiny will notify you as soon as your audit and personalized action plan are ready.</p></div><p style="color:#71807a;margin-top:32px">One clear SEO action at a time. That is how momentum compounds.</p></div>`,
      text: `${input.firstName.trim() ? `Hi ${input.firstName.trim()},` : "Hi,"}\n\nWelcome to your Destiny.\n\nYour profile for ${input.domain} is complete. We are preparing your website audit, competitor research, keyword strategy, and first weekly quest.\n\nDestiny will notify you as soon as your audit and action plan are ready.`,
      tags: [{ name: "product", value: "destiny" }, { name: "message", value: "welcome" }],
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
