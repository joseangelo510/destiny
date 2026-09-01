import { notFound } from "next/navigation";
import { DraftDashboard } from "@/components/rebound-core/core-pages";
import { loadReboundDraft } from "@/lib/rebound-core/load-core-pages";

export const dynamic = "force-dynamic";

export default async function ReboundDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!draftId.trim()) notFound();
  const view = await loadReboundDraft(draftId);
  if (!view) notFound();
  return <DraftDashboard view={view} />;
}
