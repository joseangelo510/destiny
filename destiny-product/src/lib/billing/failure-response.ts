/** Preserve recognized billing failures without exposing provider response text. */
export async function billingFailureResponse(error: unknown): Promise<Response | null> {
  const context = error && typeof error === "object" && "context" in error ? error.context : null;
  if (!(context instanceof Response) || ![402, 403, 409].includes(context.status)) return null;
  const payload = await context.clone().json().catch(() => null);
  const messages: Record<string, string> = {
    BILLING_VERIFICATION_REQUIRED: "Verify your sign-in email before starting this work.",
    BILLING_LIMIT_REACHED: "You've used this plan's allowance. Upgrade your plan or wait for your next billing period.",
    BILLING_PAYMENT_REQUIRED: "Choose a plan or update your payment to continue. Your saved work is still available.",
    BILLING_MANAGED_WEBSITE_REQUIRED: "The website owner must select this site under Managed websites in billing before starting new paid work.",
    BILLING_DUPLICATE: "This request has already started. Check your saved results before trying again.",
  };
  const code = payload?.code;
  if (typeof code !== "string" || !Object.hasOwn(messages, code)) return null;
  return Response.json({ error: messages[code], code, billingUrl: "/account/billing" }, { status: code === "BILLING_VERIFICATION_REQUIRED" ? 403 : code === "BILLING_DUPLICATE" ? 409 : 402, headers: { "Cache-Control": "private, no-store" } });
}
