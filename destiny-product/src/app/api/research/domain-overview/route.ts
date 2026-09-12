import { NextResponse } from "next/server";
import { scopedClient } from "@/lib/db";
import { domainOverviewRequests } from "../../../../../supabase/functions/seo-research/domain-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.websiteId !== "string" || !body.websiteId.trim()) return NextResponse.json({ error: "Choose a workspace before researching a domain." }, { status: 400 });
  const db = await scopedClient(body.websiteId);
  if (!await db.getClaims()) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const { data: website, error: websiteError } = await db.website("id").maybeSingle();
  if (websiteError || !website) return NextResponse.json({ error: "This website is not available in your workspace." }, { status: 404 });
  let target: string, market: string;
  try {
    if (typeof body.target !== "string" || typeof body.market !== "string") throw new Error();
    const plan = domainOverviewRequests(body.target, body.market);
    target = plan.target; market = plan.market;
  } catch { return NextResponse.json({ error: "Enter a valid public domain and choose a supported country." }, { status: 400 }); }
  try {
    const { data, error } = await db.invokeFunction<Record<string, unknown>>("seo-research", { kind: "domain_overview", target, market });
    if (error || !data || data.error) return NextResponse.json({ error: "Domain research is temporarily unavailable. Please try again." }, { status: 502 });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Domain research is temporarily unavailable. Please try again." }, { status: 502 }); }
}
