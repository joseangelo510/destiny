import { withSupabase } from "@supabase/server";
import { notificationRecipient } from "../notification-recipient.ts";
import { sendProgressReport } from "./email.ts";
import { buildProgressReportSummary } from "./logic.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function progressUrl(websiteId: string) {
  const configured = Deno.env.get("DESTINY_SITE_URL")?.trim() || "https://app.reboundseo.com";
  const url = new URL("/app/progress", configured);
  url.searchParams.set("site", websiteId);
  return url.toString();
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await request.json().catch(() => ({})) as { requestId?: unknown; websiteId?: unknown };
    const websiteId = typeof body.websiteId === "string" && UUID.test(body.websiteId) ? body.websiteId : null;
    const requestId = typeof body.requestId === "string" && UUID.test(body.requestId) ? body.requestId : null;
    if (!websiteId || !requestId) return json({ error: "Choose a valid website and report request." }, 400);

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);
    const { data: website, error: websiteError } = await context.supabase
      .from("websites")
      .select("id,business_name,normalized_domain,notification_email")
      .eq("id", websiteId)
      .maybeSingle();
    if (websiteError || !website) return json({ error: "You do not have access to that website." }, 403);

    const [{ data: profile, error: profileError }, { data: quests, error: questsError }, { data: plans, error: plansError }, { data: receipts, error: receiptsError }] = await Promise.all([
      context.supabase.from("profiles").select("contact_email").eq("id", userId).maybeSingle(),
      context.supabase.from("quests").select("title,description,status,verification_status,completed_at,guidance_state,blocker_reason").eq("website_id", website.id).order("priority").limit(500),
      context.supabase.from("publishing_plans").select("id").eq("website_id", website.id).order("updated_at", { ascending: false }).limit(1),
      context.supabase.rpc("read_cms_transfer_states", { p_website_id: website.id }),
    ]);
    if (profileError || questsError || plansError || receiptsError) return json({ error: "Rebound SEO could not load a complete progress report." }, 502);
    const planId = plans?.[0]?.id;
    const { data: scheduleItems, error: scheduleError } = planId
      ? await context.supabase.from("publishing_schedule_items").select("title,keyword,scheduled_for,state,last_error").eq("website_id", website.id).eq("plan_id", planId).order("scheduled_for")
      : { data: [], error: null };
    if (scheduleError) return json({ error: "Rebound SEO could not load a complete progress report." }, 502);
    const recipient = notificationRecipient(website.notification_email, profile?.contact_email);
    if (!recipient) return json({ error: "Add a valid report email in Account before sending." }, 409);
    const summary = buildProgressReportSummary({ quests: quests ?? [], scheduleItems: scheduleItems ?? [], receipts: Array.isArray(receipts) ? receipts : [] });
    const delivery = await sendProgressReport({
      siteName: website.business_name?.trim() || website.normalized_domain,
      domain: website.normalized_domain,
      progressUrl: progressUrl(website.id),
      recipient,
      requestId,
      websiteId: website.id,
      summary,
    });
    if (delivery.status !== "accepted") return json({ status: delivery.status, error: delivery.reason }, delivery.status === "skipped" ? 503 : 502);
    console.info("Progress report accepted", { websiteId: website.id, messageId: delivery.messageId });
    return json(delivery, 202);
  }),
};
