"use client";

import { useState } from "react";
import { DirectoryProfileRegistry, type DirectoryProfile } from "./directory-profile-registry";
import { FeatureJourneyCallout } from "./feature-journey-callout";
import type { DirectoryRecommendation } from "@/lib/distribution/recommendations";

function savedProfileCount(profiles: DirectoryProfile[]) {
  return profiles.filter((profile) => Boolean(profile.profile_url)).length;
}

export function ReviewsDirectoryWorkspace({ directories, googleConnected, initialProfiles, websiteId }: {
  directories: DirectoryRecommendation[];
  googleConnected: boolean;
  initialProfiles: DirectoryProfile[];
  websiteId: string;
}) {
  const [savedCount, setSavedCount] = useState(() => savedProfileCount(initialProfiles));
  const complete = googleConnected || savedCount > 0;
  const actionLabel = complete
    ? savedCount > 0 ? "Public profile saved" : "Google reviews connected"
    : "Save one public profile";

  return <>
    <FeatureJourneyCallout
      actionHref={complete ? undefined : "#directory-registry"}
      actionLabel={actionLabel}
      complete={complete}
      description="Keep the places customers compare your business in one trustworthy registry."
      doneLooksLike="A profile URL is saved, or connected Google review data is synced."
      evidence="A monitored public URL or a connected Business Profile snapshot."
      milestone="Grow what works"
    />
    <section className="workspace-card directory-registry-section" id="directory-registry">
      <div className="distribution-section-heading">
        <div>
          <span className="eyebrow">Directory registry</span>
          <h2>Save every public profile in one place</h2>
          <p>Google Business Profile supports a direct connection. Yelp, Apple Maps, Product Hunt, G2, and Capterra use their public profile URLs for honest, source-labeled monitoring.</p>
        </div>
        <strong aria-live="polite">{savedCount} {savedCount === 1 ? "URL" : "URLs"} saved</strong>
      </div>
      <DirectoryProfileRegistry
        directories={directories}
        googleConnected={googleConnected}
        initialProfiles={initialProfiles}
        onSavedProfileCountChange={setSavedCount}
        websiteId={websiteId}
      />
    </section>
  </>;
}
