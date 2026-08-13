import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderReoptimizationWordDocument, type ReoptimizationManifest } from "@/lib/seo/reoptimization-document";
import { createClient } from "@/lib/supabase/server";

const safeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "seo-change-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data } = await (supabase as unknown as SupabaseClient).from("reoptimization_documents").select("manifest,user_id").eq("id", id).maybeSingle();
  if (!data || data.user_id !== userId) return NextResponse.json({ error: "Change document not found." }, { status: 404 });
  const stored = data.manifest as Partial<ReoptimizationManifest>;
  if (stored.version !== 4 || !stored.strategy || !stored.research) return NextResponse.json({ error: "This older draft was retired. Regenerate it from Keyword Strategy to use Destiny's simplified heading and keyword framework." }, { status: 409 });
  const manifest = stored as ReoptimizationManifest;
  return new NextResponse(renderReoptimizationWordDocument(manifest), {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName(manifest.keyword)}-reoptimization.doc"`,
      "Cache-Control": "private, no-store",
    },
  });
}
