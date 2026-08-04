import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JsonRecord = Record<string, unknown>;

export function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function requireWorkspaceClient() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

export async function getWorkspaceContext() {
  const { supabase, userId } = await requireWorkspaceClient();
  const [{ data: website }, { data: profile }] = await Promise.all([
    supabase
      .from("websites")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("first_name,last_name,contact_email,founder_why").eq("id", userId).maybeSingle(),
  ]);

  if (!website) {
    return { supabase, userId, profile, website: null, audit: null, metrics: null, quests: [], competitors: [], integrations: [] };
  }

  const [{ data: audit }, { data: quests }, { data: competitors }, { data: integrations }] = await Promise.all([
    supabase.from("audits").select("*").eq("website_id", website.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("quests").select("*").eq("website_id", website.id).order("priority", { ascending: true }).order("created_at", { ascending: true }).limit(500),
    supabase.from("competitors").select("name,url").eq("website_id", website.id).order("created_at", { ascending: true }),
    supabase.from("integrations").select("*").eq("website_id", website.id).order("provider", { ascending: true }),
  ]);

  const { data: metrics } = audit
    ? await supabase.from("audit_metrics").select("*").eq("audit_id", audit.id).maybeSingle()
    : { data: null };

  return {
    supabase,
    userId,
    profile,
    website,
    audit,
    metrics,
    quests: quests ?? [],
    competitors: competitors ?? [],
    integrations: integrations ?? [],
  };
}

export function providerResultFromMetrics(metrics: { raw_provider_payload: unknown } | null) {
  const raw = record(metrics?.raw_provider_payload);
  return record(raw.providerResult);
}
