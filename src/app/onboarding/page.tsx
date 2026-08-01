import type { Metadata } from "next";
import { PublicOnboarding } from "@/components/public-onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyze your website — Destiny",
  description: "Tell Destiny about your business and begin a live SEO analysis.",
};

export default function OnboardingPage() {
  return <PublicOnboarding />;
}
