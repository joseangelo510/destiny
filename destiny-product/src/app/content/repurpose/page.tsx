import Link from "next/link";
import { scopedClient } from "@/lib/db";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { RepurposeWorkspace, type DraftRecord } from "@/components/repurpose-workspace";
import { articleGenerationCapability } from "@/lib/content/article-generation";
import { isRepurposeOutput, REPURPOSE_OUTPUT_OPTIONS } from "@/lib/content/repurpose";
import { getWorkspaceContext } from "@/lib/workspace-context";

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function RepurposePage({ searchParams }: {
  searchParams: Promise<{ source?: string; draftsPage?: string }>;
}) {
  const context = await getWorkspaceContext();
  const generationCapability = articleGenerationCapability(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_COPY_MODEL);
  if (!context.website) return <WorkspaceShell active="/content/repurpose" eyebrow="Rebound SEO workspace" title="Repurpose content" description="Turn an existing article, video, or document into a fresh format ready for review.">
    <WorkspaceEmpty title="No website connected" description="Add your first website to start repurposing content into new formats." />
  </WorkspaceShell>;

  const params = await searchParams;
  const sourceId = typeof params.source === "string" ? params.source : "";
  const requestedPage = Number(params.draftsPage);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100_000 ? requestedPage : 1;
  const websiteId = context.website.id;
  const database = await scopedClient(websiteId);
  const href = (extra: Record<string, string> = {}) => `/content/repurpose?${new URLSearchParams({ site: websiteId, ...extra })}`;
  const [{ data: keywords }, drafts, selected] = await Promise.all([
    context.supabase.from("keyword_preferences").select("keyword").eq("website_id", websiteId).eq("decision", "approved"),
    // Metadata only for the list. Body text is loaded only for the selected draft.
    database.select("repurpose_sources", "id,draft_title,output_type,source_name,updated_at")
      .not("draft_body", "is", null).not("output_type", "is", null)
      .order("updated_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    sourceId && UUID.test(sourceId)
      ? database.select("repurpose_sources", "id,draft_title,draft_body,output_type,source_name,source_url,target_keyword")
        .eq("id", sourceId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const saved = selected.error ? null : selected.data;
  const initialDraft: DraftRecord | undefined = saved && isRepurposeOutput(saved.output_type)
    && typeof saved.draft_title === "string" && typeof saved.draft_body === "string"
    ? { sourceId: saved.id, title: saved.draft_title, bodyMarkdown: saved.draft_body, output: saved.output_type,
      sourceAttribution: saved.source_url || saved.source_name, sourceUrl: saved.source_url || undefined,
      targetKeyword: saved.target_keyword || undefined }
    : undefined;
  const rows = drafts.error ? [] : drafts.data ?? [];

  return <WorkspaceShell active="/content/repurpose" eyebrow={context.website.normalized_domain ?? "Rebound SEO workspace"} title="Repurpose content"
    description="Turn an existing article, video, or document into a fresh Content Studio format. Every output is a reviewable draft — nothing is published automatically.">
    <section className="workspace-card" aria-labelledby="saved-repurpose-drafts">
      <h2 id="saved-repurpose-drafts">Saved drafts</h2>
      <p>Reopen your saved work for this website. Opening or editing a draft does not generate new content.</p>
      {/* A full navigation also clears an unsaved new-source editor on this URL. */}
      <a href={href()}>Start a new source</a>
      {drafts.error ? <p role="alert">Saved drafts could not be loaded. Reload to try again. Your saved work has not been removed.</p>
        : rows.length ? <ul>{rows.slice(0, PAGE_SIZE).map(row => <li key={row.id}>
          <Link aria-current={row.id === sourceId ? "page" : undefined} href={href({ source: row.id, draftsPage: String(page) })}>{row.draft_title || "Untitled draft"}</Link>
          {" — "}{REPURPOSE_OUTPUT_OPTIONS.find(option => option.value === row.output_type)?.label ?? "Draft"}
        </li>)}</ul> : <p>{page === 1 ? "No saved drafts yet." : "No drafts on this page."}</p>}
      <nav aria-label="Saved draft pages">
        {page > 1 && <Link href={href({ draftsPage: String(page - 1) })}>Newer drafts</Link>}
        {rows.length > PAGE_SIZE && <Link href={href({ draftsPage: String(page + 1) })}>Older drafts</Link>}
      </nav>
    </section>
    {sourceId && !initialDraft && <p role="alert">{selected.error ? "This draft could not be loaded. Reload to try again." : "Draft not found for this website. Choose a saved draft above or start a new source."}</p>}
    <RepurposeWorkspace key={`${websiteId}:${sourceId || "new"}`} websiteId={websiteId}
      approvedKeywords={(keywords ?? []).map(row => row.keyword as string).filter(Boolean)}
      generationAvailable={generationCapability.available} initialDraft={initialDraft} />
  </WorkspaceShell>;
}
