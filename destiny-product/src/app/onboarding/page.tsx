import type { Metadata } from "next";
import { PublicOnboarding } from "@/components/public-onboarding";
import { runDestinyServerLogic } from "@/lib/logicaffeine-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyze your website — Destiny",
  description: "Tell Destiny about your business and begin a live SEO analysis.",
};

export default async function OnboardingPage() {
  const initialMomentumPolicy = await runDestinyServerLogic({
    auditComplete: 0, criticalIssues: 0, warnings: 0, rankingKeywords: 0,
    newKeywords: 0, lostKeywords: 0, contentGaps: 0, reviewCount: 0,
    momentumOnboardingStep: 1,
  });
  return <PublicOnboarding initialMomentumPolicy={initialMomentumPolicy} />;
}
