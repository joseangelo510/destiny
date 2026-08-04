import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (claimsData?.claims?.sub) {
    return NextResponse.json({ authenticated: true, created: false });
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Destiny could not start your private workspace. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ authenticated: true, created: true });
}
