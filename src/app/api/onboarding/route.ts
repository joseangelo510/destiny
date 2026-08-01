import { NextResponse } from "next/server";
import { normalizeWebsite } from "@/lib/seo/url";
import { createClient } from "@/lib/supabase/server";

type OnboardingPayload = {
  business?: unknown;
  businessName?: unknown;
  competitors?: unknown;
  customer?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  localMarket?: unknown;
  country?: unknown;
  standout?: unknown;
  website?: unknown;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as OnboardingPayload;
    const firstName = text(body.firstName, 80);
    const lastName = text(body.lastName, 80);
    const businessName = text(body.businessName, 160);
    const email = text(body.email, 320).toLowerCase();
    const business = text(body.business, 4000);
    const customer = text(body.customer, 4000);
    const standout = text(body.standout, 4000);
    const competitors = text(body.competitors, 4000);
    const localMarket = text(body.localMarket, 240);
    const country = text(body.country, 120) || "United States";
    const website = normalizeWebsite(text(body.website, 2048));

    if (!firstName || !lastName || !businessName || !/^\S+@\S+\.\S+$/.test(email) || !business || !customer || !standout) {
      return NextResponse.json({ error: "Complete every onboarding field." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const { error: profileError } = await supabase.from("profiles").update({
      first_name: firstName,
      last_name: lastName,
      contact_email: email,
    }).eq("id", userId);
    if (profileError) throw profileError;

    const { data: existingMembership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;

    let organizationId = existingMembership?.organization_id;
    if (!organizationId) {
      const { data, error } = await supabase.rpc("create_organization", {
        organization_name: businessName,
      });
      if (error) throw error;
      organizationId = data;
    }

    const websiteValues = {
      url: website.url,
      normalized_domain: website.domain,
      business_name: businessName,
      products_services: business,
      ideal_customer: customer,
      differentiation: standout,
      market: localMarket ? `${localMarket} · ${country}` : country,
      onboarding_completed_at: new Date().toISOString(),
    };
    const { data: existingWebsite, error: existingWebsiteError } = await supabase
      .from("websites")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("normalized_domain", website.domain)
      .maybeSingle();
    if (existingWebsiteError) throw existingWebsiteError;

    const websiteQuery = existingWebsite
      ? supabase.from("websites").update(websiteValues).eq("id", existingWebsite.id)
      : supabase.from("websites").insert({ organization_id: organizationId, ...websiteValues });
    const { data: savedWebsite, error: websiteError } = await websiteQuery.select("id").single();
    if (websiteError) throw websiteError;

    const competitorNames = competitors.split(/\r?\n|,|\band\b/i).map((name) => name.trim()).filter(Boolean).slice(0, 10);
    const { error: deleteError } = await supabase.from("competitors").delete().eq("website_id", savedWebsite.id);
    if (deleteError) throw deleteError;
    if (competitorNames.length) {
      const { error: competitorError } = await supabase.from("competitors").insert(
        competitorNames.map((name) => ({ website_id: savedWebsite.id, name })),
      );
      if (competitorError) throw competitorError;
    }

    const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke("send-welcome", {
      body: { websiteId: savedWebsite.id },
    });

    return NextResponse.json({
      organizationId,
      websiteId: savedWebsite.id,
      welcomeEmail: welcomeError ? { status: "failed", reason: welcomeError.message } : welcomeData?.delivery,
    });
  } catch (cause) {
    const message = cause instanceof Error
      ? cause.message
      : cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string"
      ? cause.message
      : "Destiny could not save onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
