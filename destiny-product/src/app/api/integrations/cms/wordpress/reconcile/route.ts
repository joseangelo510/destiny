import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { websiteId?: unknown; articleKey?: unknown } | null;
  const websiteId = typeof body?.websiteId === "string" ? body.websiteId.trim() : "";
  const articleKey = typeof body?.articleKey === "string" ? body.articleKey.trim() : "";
  if (!websiteId || !articleKey) return NextResponse.json({ error: "Choose a WordPress article to check." }, { status: 400 });

  const { data, error } = await supabase.functions.invoke<{
    reconciled?: boolean;
    publicationStatus?: string;
    remotePermalink?: string | null;
    lastReconciledAt?: string;
    verifiedLiveAt?: string | null;
    verificationEvidence?: Record<string, unknown>;
    seoTitleRendered?: string | null;
    error?: string;
  }>("wordpress-reconcile", { body: { websiteId, articleKey } });

  if (error || !data?.reconciled) return NextResponse.json({ error: data?.error || "Destiny could not refresh the WordPress status." }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
