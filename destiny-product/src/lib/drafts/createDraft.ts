import "server-only";
import { DEFAULT_ARTICLE_PREFERENCES } from "../content/article-generation";

type DraftProposalInput = { title: string; targetKeyword: string; angle: string; outlineBullets: string[]; writingInstructions?: string };

type DraftWriteResult = { data?: unknown; error: { message?: string } | null };
type RawDraftClient = {
  from(table: "article_drafts"): {
    upsert(rows: Array<Record<string, unknown>>, options: { onConflict: string }): PromiseLike<DraftWriteResult>;
  };
};

export async function persistArticleDraftRows(client: unknown, rows: Array<Record<string, unknown>>) {
  return (client as RawDraftClient).from("article_drafts").upsert(rows, {
    onConflict: "website_id,audit_id,keyword",
  });
}

export async function createDraft(
  clientValue: Awaited<ReturnType<typeof import("@/lib/db").scopedClient>>,
  context: {
    userId: string;
    organizationId: string;
    websiteId: string;
    auditId: string;
  },
  input: DraftProposalInput,
) {
  const client = clientValue;
  const keyword = input.targetKeyword.trim();
  const { data: existing, error: existingError } = await client.select("article_drafts", "id,draft")
    .eq("audit_id", context.auditId)
    .eq("keyword", keyword)
    .maybeSingle();
  if (existingError) throw new Error("The existing draft could not be checked.");
  if (existing?.id) return { id: String(existing.id), existed: true };

  const draft = {
    keyword,
    title: input.title,
    body: "",
    generationStatus: "starter",
    approved: false,
    ...(input.writingInstructions ? { preferences: { ...DEFAULT_ARTICLE_PREFERENCES, specialInstructions: input.writingInstructions } } : {}),
    agentBrief: {
      angle: input.angle,
      outlineBullets: input.outlineBullets,
    },
  };
  const { data, error } = await client.insert("article_drafts", {
    organization_id: context.organizationId,
    website_id: context.websiteId,
    audit_id: context.auditId,
    user_id: context.userId,
    keyword,
    draft,
    updated_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !data) throw new Error("The draft could not be created.");
  return { id: String(data.id), existed: false };
}
