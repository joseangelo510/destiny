import { NextResponse } from "next/server";
import { createDraft } from "@/lib/drafts/createDraft";
import { loadRequestScope } from "@/lib/agent/store";
import { isUuid, validateDraftProposal } from "@/lib/agent/validate";
import { scopedClient } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  if (!isUuid(proposalId) || !isUuid(body.websiteId) || !action) {
    return NextResponse.json({ error: "Choose a valid draft proposal decision." }, { status: 400 });
  }

  const client = await scopedClient(body.websiteId);
  const userId = await client.getClaims();
  if (!userId) return NextResponse.json({ error: "Sign in again to decide this proposal." }, { status: 401 });
  const scope = await loadRequestScope(client, userId, body.websiteId);
  if (!scope) return NextResponse.json({ error: "The selected website is not available." }, { status: 404 });

  const { data: proposal, error } = await scope.client.select("agent_proposals", "id,payload,status")
    .eq("id", proposalId)
    .eq("website_id", scope.websiteId)
    .maybeSingle();
  if (error || !proposal || proposal.status !== "proposed") {
    return NextResponse.json({ error: "This proposal is no longer available." }, { status: 409 });
  }

  const decidedAt = new Date().toISOString();
  if (action === "reject") {
    const { data: updated, error: updateError } = await scope.client.update("agent_proposals", {
      status: "rejected",
      result: { reason: "Rejected by user" },
      decided_by: userId,
      decided_at: decidedAt,
    }, { id: proposalId, status: "proposed" }).select("id").maybeSingle();
    if (updateError || !updated) return NextResponse.json({ error: "The rejection could not be saved." }, { status: 409 });
    return NextResponse.json({ status: "rejected" });
  }

  const validated = validateDraftProposal(proposal.payload);
  if (!validated.ok) {
    return NextResponse.json({ error: "The stored proposal failed safety validation." }, { status: 400 });
  }
  const { data: audit } = await scope.client.select("audits", "id").eq("status", "complete")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!audit?.id) return NextResponse.json({ error: "Complete an audit before creating this draft." }, { status: 409 });

  try {
    const artifact = await createDraft(scope.client, {
      userId,
      organizationId: scope.organizationId,
      websiteId: scope.websiteId,
      auditId: String(audit.id),
    }, validated.value);
    const { data: updated, error: updateError } = await scope.client.update("agent_proposals", {
      status: "approved",
      result: { existed: artifact.existed },
      artifact_id: artifact.id,
      decided_by: userId,
      decided_at: decidedAt,
    }, { id: proposalId, status: "proposed" }).select("id").maybeSingle();
    if (updateError || !updated) throw new Error("The proposal decision could not be saved.");
    return NextResponse.json({
      status: "approved",
      artifactId: artifact.id,
      href: "/app/content/" + artifact.id + "?site=" + scope.websiteId,
    });
  } catch {
    return NextResponse.json({ error: "The draft could not be created safely." }, { status: 500 });
  }
}
