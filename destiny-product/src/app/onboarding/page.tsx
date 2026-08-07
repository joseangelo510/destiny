import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicOnboarding } from "@/components/public-onboarding";
import { onboardingEntryDestination } from "@/lib/auth/workspace-entry";
import { runDestinyServerLogic } from "@/lib/logicaffeine-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyze your website — Destiny",
  description: "Tell Destiny about your business and begin a live SEO analysis.",
};

type OnboardingPageProps = {
  searchParams: Promise<{ new?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: claimsData }, { data: userData }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getUser(),
  ]);
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  const { data: website } = userId
    ? await supabase.from("websites").select("id").limit(1).maybeSingle()
    : { data: null };
  const destination = onboardingEntryDestination({
    authenticated: Boolean(userId),
    hasWebsite: Boolean(website),
    startNew: params.new === "1",
  });
  if (destination) redirect(destination);

  const initialMomentumPolicy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0,
    newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    momentumOnboardingStep: 1,
  });
  return <PublicOnboarding initialEmail={userData.user?.email ?? ""} initialMomentumPolicy={initialMomentumPolicy} />;
}
