import { currentArticleQualityIssues, type ArticleDraft } from "@/lib/content/article-draft";
import type { ArticleQualityIssue } from "@/lib/content/article-generation";

export type StoredArticleDraft = Record<string, unknown>;

type DraftFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function toggleDraftApproval(draft: StoredArticleDraft, approved: boolean): StoredArticleDraft {
  return { ...draft, approved };
}

export async function approvalGate(draft: StoredArticleDraft): Promise<{ canApprove: boolean; issues: ArticleQualityIssue[] }> {
  if (draft.generationStatus !== "generated") {
    return {
      canApprove: false,
      issues: [{ code: "generation_required", message: "Generate the complete article before approval." }],
    };
  }
  try {
    const issues = await currentArticleQualityIssues(draft as unknown as ArticleDraft);
    return { canApprove: issues.length === 0, issues };
  } catch {
    return {
      canApprove: false,
      issues: [{ code: "generation_required", message: "Rebound SEO could not verify the article rules. Open Content Studio before approval." }],
    };
  }
}

export async function saveDraftApproval({
  auditId,
  approved,
  draft,
  fetcher = globalThis.fetch,
  websiteId,
}: {
  auditId: string;
  approved: boolean;
  draft: StoredArticleDraft;
  fetcher?: DraftFetcher;
  websiteId: string;
}) {
  const next = toggleDraftApproval(draft, approved);
  const response = await fetcher("/api/content/drafts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ websiteId, auditId, drafts: [next] }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; saved?: number };
  if (!response.ok || payload.saved !== 1) {
    throw new Error(payload.error || "Rebound SEO could not save this approval yet.");
  }
  return next;
}
