import { NextResponse } from "next/server";
import { billingSessionClient } from "@/lib/db/billing";
import { billingOrigin, runPaymentAction } from "@/lib/billing/payment-action";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = billingOrigin(request);
  if (!origin) return NextResponse.json({ error: "Open billing from Rebound SEO." }, { status: 403 });
  const session = await billingSessionClient();
  if (!await session.getClaims()) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return runPaymentAction(request, "checkout", session, origin);
}
