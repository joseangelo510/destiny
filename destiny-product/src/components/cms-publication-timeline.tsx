import type { PublicationReceiptStage } from "@/lib/cms/publication-receipt";

export function CmsPublicationTimeline({ stage }: { stage?: PublicationReceiptStage }) {
  return (<ol className="cms-publication-timeline" aria-label="WordPress publication progress">
            <li className="complete"><span>1</span><div><strong>Draft delivered</strong><small>Delivery recorded; current page checked below</small></div></li>
            <li className={stage === "scheduled" || stage === "published_unverified" || stage === "live_verified" || stage === "attention" ? "complete" : "current"}><span>2</span><div><strong>Review and publish</strong><small>Formatting and SEO plugin fields remain under your control</small></div></li>
            <li className={stage === "live_verified" ? "complete" : stage === "published_unverified" || stage === "attention" ? "current" : ""}><span>3</span><div><strong>Verify the live page</strong><small>HTTP, canonical, content match, and indexability</small></div></li>
          </ol>
  );
}
