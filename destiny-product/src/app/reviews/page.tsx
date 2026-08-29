import { WorkspaceLink as Link } from "@/components/workspace-link";
import { DirectoryProfileRegistry, type DirectoryProfile } from "@/components/directory-profile-registry";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { baseDirectories } from "@/lib/distribution/recommendations";
import { getWorkspaceContext, list, record } from "@/lib/workspace-context";

export default async function ReviewsPage() {
  const context = await getWorkspaceContext();
  const googleBusiness = context.integrations.find((item) => item.provider === "google_business_profile");
  const businessMetadata = record(googleBusiness?.metadata);
  const synced = googleBusiness?.status === "connected" && Boolean(googleBusiness.last_synced_at);
  const reviewCount = synced ? Number(businessMetadata.reviewCount ?? 0) : context.metrics?.google_reviews ?? 0;
  const averageRating = synced ? Number(businessMetadata.averageRating ?? 0) : null;
  const recentReviews = synced ? list(businessMetadata.recentReviews).map(record) : [];
  const { data: directoryProfiles } = context.website
    ? await context.supabase.from("directory_profiles").select("directory_key,profile_url,status,http_status,last_checked_at,public_rating,public_review_count").eq("website_id", context.website.id)
    : { data: [] };

  return (
    <WorkspaceShell active="/reviews" eyebrow={context.website?.normalized_domain ?? "Rebound SEO workspace"} title="Reviews & public profiles" description="Keep one reliable registry of the places customers use to verify, compare, and review your business.">
      <FeatureJourneyCallout actionHref="#directory-registry" actionLabel="Save one public profile" milestone="Grow what works" description="Keep the places customers compare your business in one trustworthy registry." doneLooksLike="A profile URL is saved, or connected Google review data is synced." evidence="A monitored public URL or a connected Business Profile snapshot." />
      {!context.website ? <WorkspaceEmpty title="Add your business first" description="Complete onboarding before connecting and measuring your public profiles." /> : <>
        <section className="review-grid">
          <article className="workspace-card review-score"><span className={`status-chip ${synced ? "" : "amber"}`}>{synced ? "Synced" : googleBusiness?.status ?? "Not connected"}</span><strong>{reviewCount.toLocaleString()}</strong><h2>Google reviews</h2>{averageRating !== null && <p><b>{averageRating.toFixed(1)} average rating</b> from the connected Business Profile.</p>}<p>{synced ? `Latest Google snapshot: ${new Date(googleBusiness.last_synced_at!).toLocaleString()}.` : "Connect Google Business Profile for reliable live review data. A pasted URL is monitored as public evidence, not treated as a connection."}</p><Link className="primary-button workspace-action" href="/integrations">Manage Google connection</Link></article>
          <article className="workspace-card"><div className="workspace-card-heading"><strong>Weekly review habit</strong><span>Build trusted proof</span></div><ol className="checklist"><li><span>1</span>Ask two recent customers for an honest review</li><li><span>2</span>Respond to every new review in your own voice</li><li><span>3</span>Capture one recurring phrase for future content</li><li><span>4</span>Measure review-assisted website conversions</li></ol></article>
          {recentReviews.length > 0 && <article className="workspace-card recent-reviews"><div className="workspace-card-heading"><strong>Recent Google feedback</strong><span>Connected data</span></div>{recentReviews.map((review, index) => <div className="recent-review" key={`${String(review.updateTime)}-${index}`}><strong>{String(review.reviewer || "Google reviewer")}</strong><small>{String(review.starRating).replaceAll("_", " ")}</small><p>{String(review.comment || "No written comment")}</p></div>)}</article>}
        </section>
        <section className="workspace-card directory-registry-section" id="directory-registry"><div className="distribution-section-heading"><div><span className="eyebrow">Directory registry</span><h2>Save every public profile in one place</h2><p>Google Business Profile supports a direct connection. Yelp, Apple Maps, Product Hunt, G2, and Capterra use their public profile URLs for honest, source-labeled monitoring.</p></div><strong>{(directoryProfiles ?? []).filter((item) => item.profile_url).length} URLs saved</strong></div><DirectoryProfileRegistry directories={baseDirectories} googleConnected={synced} initialProfiles={(directoryProfiles ?? []) as DirectoryProfile[]} websiteId={context.website.id} /></section>
      </>}
    </WorkspaceShell>
  );
}
