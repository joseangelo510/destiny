import { createClient } from "../../../../lib/supabase/server";
import { isWebsiteId } from "../../../../lib/workspace-selection";
import { computeNextDigestAt, isRankingDigestFrequency } from "../../../../lib/notifications/ranking-digest";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return Response.json({ error: "Sign in again to manage ranking emails." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { websiteId?: unknown; frequency?: unknown };
  if (!isWebsiteId(body.websiteId)) return Response.json({ error: "Choose a website before changing its ranking emails." }, { status: 400 });
  if (!isRankingDigestFrequency(body.frequency)) return Response.json({ error: "Choose Every 3 days, Weekly, or Off." }, { status: 400 });

  const now = new Date().toISOString();
  const { data: preference, error } = await supabase.from("notification_preferences")
    .update({
      ranking_digest_frequency: body.frequency,
      next_digest_at: computeNextDigestAt(body.frequency, now),
      // Choosing a cadence re-enables a previously unsubscribed website; Off leaves the record explicit.
      unsubscribed_at: body.frequency === "off" ? now : null,
      updated_at: now,
    })
    .eq("website_id", body.websiteId)
    .select("website_id,ranking_digest_frequency,next_digest_at,last_digest_sent_at,last_digest_status,unsubscribed_at")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!preference) return Response.json({ error: "Destiny could not find ranking email settings for that website." }, { status: 404 });
  return Response.json({
    websiteId: preference.website_id,
    frequency: preference.ranking_digest_frequency,
    nextDigestAt: preference.next_digest_at,
    lastDigestSentAt: preference.last_digest_sent_at,
    lastDigestStatus: preference.last_digest_status,
    unsubscribedAt: preference.unsubscribed_at,
  });
}
