import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { RepurposeWorkspace } from "@/components/repurpose-workspace";
import { articleGenerationCapability } from "@/lib/content/article-generation";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function RepurposePage() {
  const context = await getWorkspaceContext();
  const generationCapability = articleGenerationCapability(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_COPY_MODEL,
  );

  if (!context.website) {
    return (
      <WorkspaceShell
        active="/content/repurpose"
        eyebrow="Rebound SEO workspace"
        title="Repurpose content"
        description="Turn an existing article, video, or document into a fresh format ready for review."
      >
        <WorkspaceEmpty
          title="No website connected"
          description="Add your first website to start repurposing content into new formats."
        />
      </WorkspaceShell>
    );
  }

  // Load only approved keyword_preferences for the current website
  const { data: keywordPreferences } = await context.supabase
    .from("keyword_preferences")
    .select("keyword")
    .eq("website_id", context.website.id)
    .eq("decision", "approved");

  const approvedKeywords = (keywordPreferences ?? []).map((row) => row.keyword as string).filter(Boolean);

  return (
    <WorkspaceShell
      active="/content/repurpose"
      eyebrow={context.website.normalized_domain ?? "Rebound SEO workspace"}
      title="Repurpose content"
      description="Turn an existing article, video, or document into a fresh Content Studio format. Every output is a reviewable draft — nothing is published automatically."
    >
      <RepurposeWorkspace
        websiteId={context.website.id}
        approvedKeywords={approvedKeywords}
        generationAvailable={generationCapability.available}
      />
    </WorkspaceShell>
  );
}
