import type { Metadata } from "next";
import { AccountSettings, type RankingEmailPreference } from "@/components/account-settings";
import type { RankingDigestFrequency, RankingDigestSendStatus } from "@/lib/notifications/ranking-digest";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account — Destiny",
  description: "Review your Destiny login identity and account settings.",
};

export default async function AccountPage() {
  const context = await getWorkspaceContext();
  const websiteIds = context.websites.map((website) => website.id);
  const [{ data }, { data: preferences }] = await Promise.all([
    context.supabase.auth.getUser(),
    websiteIds.length
      ? context.supabase.from("notification_preferences").select("website_id,ranking_digest_frequency,unsubscribed_at,last_digest_sent_at,last_digest_status").in("website_id", websiteIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const loginEmail = data.user?.email ?? "Email unavailable";
  const rankingEmailPreferences = Object.fromEntries((preferences ?? []).map((preference) => [preference.website_id, {
    frequency: preference.ranking_digest_frequency as RankingDigestFrequency,
    unsubscribedAt: preference.unsubscribed_at,
    lastDigestSentAt: preference.last_digest_sent_at,
    lastDigestStatus: preference.last_digest_status as RankingDigestSendStatus,
  } satisfies RankingEmailPreference]));
  return <WorkspaceShell active="/account" eyebrow="Account settings" title="Your account" description="See exactly which email is signed in and where Destiny sends your audit updates."><AccountSettings activeWebsiteId={context.website?.id ?? null} loginEmail={loginEmail} notificationEmail={context.website?.notification_email ?? context.profile?.contact_email ?? null} rankingEmailPreferences={rankingEmailPreferences} websites={context.websites.map((website) => ({ id: website.id, businessName: website.business_name, normalizedDomain: website.normalized_domain }))} /></WorkspaceShell>;
}
