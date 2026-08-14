import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderReoptimizationWordDocument, type ReoptimizationManifest } from "@/lib/seo/reoptimization-document";
import { createClient } from "@/lib/supabase/server";
import { createDocxFromHtml, safeDocumentName } from "@/lib/word-document";

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
  const document = await createDocxFromHtml(renderReoptimizationWordDocument(manifest), `${manifest.keyword} re-optimization plan`);
  return new NextResponse(new Uint8Array(document), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeDocumentName(manifest.keyword)}-reoptimization.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
