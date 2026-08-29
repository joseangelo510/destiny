import { createClient } from "../../../lib/supabase/server";
import { isWebsiteId } from "../../../lib/workspace-selection";
import type { SupabaseClient } from "@supabase/supabase-js";

const rankingDigestFrequencies = new Set(["three_day", "weekly", "off"]);

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return Response.json({ error: "Sign in again to manage this account." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { notificationEmail?: unknown; rankingDigestFrequency?: unknown; websiteId?: unknown };
  if (!isWebsiteId(body.websiteId)) return Response.json({ error: "Choose a website before changing its notification email." }, { status: 400 });
  const changingEmail = body.notificationEmail !== undefined;
  const changingFrequency = body.rankingDigestFrequency !== undefined;
  if (!changingEmail && !changingFrequency) return Response.json({ error: "Choose an account setting to update." }, { status: 400 });
  const notificationEmail = changingEmail ? validEmail(body.notificationEmail) : null;
  if (changingEmail && !notificationEmail) return Response.json({ error: "Enter a valid audit and contact email." }, { status: 400 });
  const rankingDigestFrequency = typeof body.rankingDigestFrequency === "string" && rankingDigestFrequencies.has(body.rankingDigestFrequency)
    ? body.rankingDigestFrequency as "three_day" | "weekly" | "off"
    : null;
  if (changingFrequency && !rankingDigestFrequency) return Response.json({ error: "Choose Every 3 days, Weekly, or Off." }, { status: 400 });

  const response: { notificationEmail?: string; rankingDigestFrequency?: string; nextDigestAt?: string | null } = {};

  if (notificationEmail) {
    const { data: website, error } = await supabase.from("websites")
      .update({ notification_email: notificationEmail, updated_at: new Date().toISOString() })
      .eq("id", body.websiteId)
      .select("notification_email")
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!website) return Response.json({ error: "Rebound SEO could not find that website in this account." }, { status: 404 });
    response.notificationEmail = website.notification_email ?? notificationEmail;
  }

  if (rankingDigestFrequency) {
    const now = new Date().toISOString();
    const untyped = supabase as unknown as SupabaseClient;
    const { data: preference, error } = await untyped.from("notification_preferences")
      .update({
        ranking_digest_frequency: rankingDigestFrequency,
        next_digest_at: rankingDigestFrequency === "off" ? null : now,
        unsubscribed_at: rankingDigestFrequency === "off" ? now : null,
        updated_at: now,
      })
      .eq("website_id", body.websiteId)
      .select("ranking_digest_frequency,next_digest_at")
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!preference) return Response.json({ error: "Rebound SEO could not find notification settings for that website." }, { status: 404 });
    response.rankingDigestFrequency = String(preference.ranking_digest_frequency);
    response.nextDigestAt = typeof preference.next_digest_at === "string" ? preference.next_digest_at : null;
  }

  return Response.json(response);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  const email = data.user?.email?.trim().toLowerCase();
  if (userError || !data.user || !email) return Response.json({ error: "Sign in again to manage this account." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { confirmation?: unknown };
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
  if (confirmation !== email) return Response.json({ error: "Enter your current login email exactly to confirm deletion." }, { status: 400 });

  const { data: deletion, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", {
    body: { confirmation: email },
  });
  if (error || !deletion?.deleted) {
    return Response.json({ error: deletion?.error || error?.message || "Rebound SEO could not delete this account." }, { status: 409 });
  }

  await supabase.auth.signOut();
  return Response.json({ deleted: true });
}
