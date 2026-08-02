import Link from "next/link";
import { FeatureJourneyCallout } from "@/components/feature-journey-callout";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext, list, record } from "@/lib/workspace-context";

export default async function ReviewsPage() {
  const context = await getWorkspaceContext();
  const googleBusiness = context.integrations.find((item) => item.provider === "google_business_profile");
  const businessMetadata = record(googleBusiness?.metadata);
  const synced = googleBusiness?.status === "connected" && Boolean(googleBusiness.last_synced_at);
  const reviewCount = synced ? Number(businessMetadata.reviewCount ?? 0) : context.metrics?.google_reviews ?? 0;
  const averageRating = synced ? Number(businessMetadata.averageRating ?? 0) : null;
  const recentReviews = synced ? list(businessMetadata.recentReviews).map(record) : [];
  return (
    <WorkspaceShell active="/reviews" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Reviews" description="Track review proof and turn customer feedback into a consistent local-search habit.">
      <FeatureJourneyCallout milestone="Compounding authority" description="Consistent review work builds trust. Destiny will keep verified search and conversion results separate from tasks you mark complete." />
      {!context.website ? <WorkspaceEmpty title="Add your business first" description="Complete onboarding before connecting and measuring your Google Business Profile." /> : (
        <section className="review-grid">
          <article className="workspace-card review-score"><span className={`status-chip ${synced ? "" : "amber"}`}>{synced ? "Synced" : googleBusiness?.status ?? "Not connected"}</span><strong>{reviewCount.toLocaleString()}</strong><h2>Google reviews</h2>{averageRating !== null && <p><b>{averageRating.toFixed(1)} average rating</b> from the connected Business Profile.</p>}<p>{synced ? `Latest Google snapshot: ${new Date(googleBusiness.last_synced_at!).toLocaleString()}.` : "The latest SEO audit does not include live Google review data. Connect and sync Google Business Profile to measure it."}</p><Link className="primary-button workspace-action" href="/integrations">Manage connection</Link></article>
          <article className="workspace-card"><div className="workspace-card-heading"><strong>Weekly review habit</strong><span>Build trusted proof</span></div><ol className="checklist"><li><span>1</span>Ask two recent customers for an honest review</li><li><span>2</span>Respond to every new review in your own voice</li><li><span>3</span>Capture one recurring phrase for future content</li><li><span>4</span>Measure review-assisted website conversions</li></ol></article>
          {recentReviews.length > 0 && <article className="workspace-card recent-reviews"><div className="workspace-card-heading"><strong>Recent Google feedback</strong><span>Read-only</span></div>{recentReviews.map((review, index) => <div className="recent-review" key={`${String(review.updateTime)}-${index}`}><strong>{String(review.reviewer || "Google reviewer")}</strong><small>{String(review.starRating).replaceAll("_", " ")}</small><p>{String(review.comment || "No written comment")}</p></div>)}</article>}
        </section>
      )}
    </WorkspaceShell>
  );
}
