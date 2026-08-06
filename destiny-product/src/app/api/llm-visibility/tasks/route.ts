import { NextResponse } from "next/server";
import { parseLlmTaskUpdate, proofUrlMatchesWebsite } from "@/lib/llm/source-progress";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = parseLlmTaskUpdate(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id,normalized_domain")
    .eq("id", parsed.value.websiteId)
    .maybeSingle();
  if (websiteError) return NextResponse.json({ error: websiteError.message }, { status: 500 });
  if (!website) return NextResponse.json({ error: "Website not found." }, { status: 404 });
  if (parsed.value.sourceKey === "owned-site" && parsed.value.proofUrl && !proofUrlMatchesWebsite(parsed.value.proofUrl, website.normalized_domain)) {
    return NextResponse.json({ error: `Use a public URL on ${website.normalized_domain} for this task.` }, { status: 400 });
  }

  const completedAt = parsed.value.status === "complete" ? new Date().toISOString() : null;
  const { data: task, error } = await supabase
    .from("llm_visibility_tasks")
    .upsert({
      website_id: website.id,
      source_key: parsed.value.sourceKey,
      task_key: parsed.value.taskKey,
      status: parsed.value.status,
      completed_by: parsed.value.status === "complete" ? userId : null,
      completed_at: completedAt,
      proof_url: parsed.value.status === "complete" ? parsed.value.proofUrl : null,
      proof_attached_at: parsed.value.status === "complete" && parsed.value.proofUrl ? new Date().toISOString() : null,
    }, { onConflict: "website_id,source_key,task_key" })
    .select("id,source_key,task_key,status,completed_at,proof_url,proof_attached_at,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Destiny could not save this source task." }, { status: 500 });
  return NextResponse.json({ task });
}
