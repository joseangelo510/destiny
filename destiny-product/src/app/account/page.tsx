import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { WorkspaceShell } from "@/components/workspace-shell";
import { isCommsBetaEnabled } from "@/lib/comms/feature";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account — Destiny",
  description: "Review your Destiny login identity and account settings.",
};

export default async function AccountPage() {
  const context = await getWorkspaceContext();
  const { data } = await context.supabase.auth.getUser();
  const loginEmail = data.user?.email ?? "Email unavailable";
  const commsEnabled = isCommsBetaEnabled();
  const { data: commsPreference } = commsEnabled && context.website
    ? await context.supabase.from("comms_preferences").select("cadence,user_timezone,email_enabled,push_enabled").eq("website_id", context.website.id).eq("user_id", context.userId).maybeSingle()
    : { data: null };
  return <WorkspaceShell active="/account" eyebrow="Account settings" title="Your account" description="See exactly which email is signed in and where Destiny sends your audit updates."><AccountSettings activeWebsiteId={context.website?.id ?? null} commsEnabled={commsEnabled} initialCommsPreference={commsPreference ? { cadence: commsPreference.cadence, userTimezone: commsPreference.user_timezone, emailEnabled: commsPreference.email_enabled, pushEnabled: commsPreference.push_enabled } : undefined} loginEmail={loginEmail} notificationEmail={context.website?.notification_email ?? context.profile?.contact_email ?? null} websites={context.websites.map((website) => ({ id: website.id, businessName: website.business_name, normalizedDomain: website.normalized_domain }))} /></WorkspaceShell>;
}
