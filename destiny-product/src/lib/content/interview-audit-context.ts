import { scopedClient } from "@/lib/db";
import type { getWorkspaceContext } from "@/lib/workspace-context";
import { isWebsiteId } from "@/lib/workspace-selection";

type WorkspaceContext = Awaited<ReturnType<typeof getWorkspaceContext>>;

export async function resolveInterviewAuditContext(context: WorkspaceContext, interviewId: unknown): Promise<WorkspaceContext> {
  if (!context.website || !isWebsiteId(interviewId)) return context;
  const drafts = await scopedClient(context.website.id);
  const db = context.supabase;
  const { data: draft, error: draftError } = await drafts.select("article_drafts", "audit_id")
    .eq("interview_id", interviewId).maybeSingle();
  if (draftError || !isWebsiteId(draft?.audit_id) || draft.audit_id === context.audit?.id) return context;
  const { data: audit, error: auditError } = await db.from("audits").select("*")
    .eq("website_id", context.website.id).eq("id", draft.audit_id).eq("status", "complete").maybeSingle();
  if (auditError || !audit) return context;
  const [metrics, quests] = await Promise.all([
    db.from("audit_metrics").select("*").eq("audit_id", audit.id).maybeSingle(),
    db.from("quests").select("*").eq("website_id", context.website.id).eq("audit_id", audit.id)
      .order("priority", { ascending: true }).order("created_at", { ascending: true }).limit(500),
  ]);
  if (metrics.error || quests.error) return context;
  return { ...context, audit, metrics: metrics.data, quests: quests.data ?? [] };
}

export async function resolveSavedDraftAuditContext(context: WorkspaceContext, draftId: unknown): Promise<{ context: WorkspaceContext; keyword: string } | null> {
  if (!context.website || !isWebsiteId(draftId)) return null;
  const drafts = await scopedClient(context.website.id);
  const { data: draft, error: draftError } = await drafts.select("article_drafts", "audit_id,keyword")
    .eq("id", draftId).maybeSingle();
  if (draftError || !isWebsiteId(draft?.audit_id) || typeof draft.keyword !== "string" || !draft.keyword.trim()) return null;
  if (draft.audit_id === context.audit?.id) return { context, keyword: draft.keyword };

  const db = context.supabase;
  const { data: audit, error: auditError } = await db.from("audits").select("*")
    .eq("website_id", context.website.id).eq("id", draft.audit_id).eq("status", "complete").maybeSingle();
  if (auditError || !audit) return null;
  const [metrics, quests] = await Promise.all([
    db.from("audit_metrics").select("*").eq("audit_id", audit.id).maybeSingle(),
    db.from("quests").select("*").eq("website_id", context.website.id).eq("audit_id", audit.id)
      .order("priority", { ascending: true }).order("created_at", { ascending: true }).limit(500),
  ]);
  if (metrics.error || quests.error) return null;
  return { context: { ...context, audit, metrics: metrics.data, quests: quests.data ?? [] }, keyword: draft.keyword };
}
