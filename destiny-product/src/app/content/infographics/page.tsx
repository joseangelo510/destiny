import { InfographicGenerator } from "@/components/infographic-generator";
import { WorkspaceEmpty } from "@/components/workspace-empty";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceContext } from "@/lib/workspace-context";

export default async function InfographicGeneratorPage() {
  const context = await getWorkspaceContext();
  const { data: approvedRows } = context.website ? await context.supabase.from("keyword_preferences")
    .select("keyword,search_volume")
    .eq("website_id", context.website.id)
    .eq("decision", "approved")
    .order("search_volume", { ascending: false })
    .limit(50) : { data: [] };
  const approvedKeywords = (approvedRows ?? []).flatMap((row) => typeof row.keyword === "string" && row.keyword.trim() ? [{ keyword: row.keyword.trim(), searchVolume: Number(row.search_volume ?? 0) }] : []);

  return <WorkspaceShell active="/content/infographics" eyebrow={context.website?.normalized_domain ?? "Destiny workspace"} title="Infographic generator" description="Research one useful topic, review the evidence, and turn it into a long visual, four reusable posts, and an editable companion article.">
    {!context.website ? <WorkspaceEmpty title="Add a website first" description="Destiny needs a business workspace before it can research an infographic." /> : <InfographicGenerator approvedKeywords={approvedKeywords} generationAvailable={Boolean(process.env.OPENAI_API_KEY?.trim())} websiteId={context.website.id} websiteName={context.website.business_name ?? context.website.normalized_domain} />}
  </WorkspaceShell>;
}
