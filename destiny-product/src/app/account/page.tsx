import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account — Destiny",
  description: "Review your Destiny login identity and account settings.",
};

export default async function AccountPage() {
  const context = await getWorkspaceContext();
  const { data } = await context.supabase.auth.getUser();
  const loginEmail = data.user?.email ?? "Email unavailable";
  const websiteIds = context.websites.map((website) => website.id);
  const untyped = context.supabase as unknown as SupabaseClient;
  const { data: preferences } = websiteIds.length
    ? await untyped.from("notification_preferences").select("website_id,ranking_digest_frequency,last_digest_sent_at").in("website_id", websiteIds)
    : { data: [] };
  const byWebsite = new Map((preferences ?? []).map((preference) => [String(preference.website_id), preference]));
  return <WorkspaceShell active="/account" eyebrow="Account settings" title="Your account" description="See exactly which email is signed in and control where and how often Destiny sends updates."><AccountSettings activeWebsiteId={context.website?.id ?? null} loginEmail={loginEmail} notificationEmail={context.website?.notification_email ?? context.profile?.contact_email ?? null} websites={context.websites.map((website) => {
    const preference = byWebsite.get(website.id);
    const frequency = preference?.ranking_digest_frequency;
    return {
      id: website.id,
      businessName: website.business_name,
      normalizedDomain: website.normalized_domain,
      rankingDigestFrequency: frequency === "three_day" || frequency === "off" ? frequency : "weekly",
      lastDigestSentAt: typeof preference?.last_digest_sent_at === "string" ? preference.last_digest_sent_at : null,
    };
  })} /></WorkspaceShell>;
}
