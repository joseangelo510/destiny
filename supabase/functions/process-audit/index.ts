import { withSupabase } from "@supabase/server";
import { sendAuditReadyEmail } from "./email.ts";
import { questCategory, runDestinyLogic } from "./logic.ts";
import { runSeoAudit } from "./seo.ts";

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

type AuditRequest = {
  websiteId?: unknown;
  locationName?: unknown;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    let body: AuditRequest;
    try {
      body = await request.json() as AuditRequest;
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }

    if (typeof body.websiteId !== "string" || !body.websiteId) {
      return json({ error: "Complete onboarding before starting an audit." }, 400);
    }

    const userId = context.userClaims?.id;
    if (!userId) return json({ error: "Sign in again to continue." }, 401);

    const [{ data: website, error: websiteError }, { data: profile }] = await Promise.all([
      context.supabase
        .from("websites")
        .select("id,url,normalized_domain,products_services,ideal_customer,market")
        .eq("id", body.websiteId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("first_name,contact_email")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (websiteError || !website) {
      return json({ error: "You do not have access to that website." }, 403);
    }

    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    const provider = login && password ? "dataforseo" : "demo";
    let auditId: string;
    try {
      const { data: startedAudit, error: beginError } = await context.supabaseAdmin.rpc(
        "begin_destiny_audit_v2",
        { p_website_id: website.id, p_user_id: userId, p_provider: provider },
      );
      const started = startedAudit && typeof startedAudit === "object" && !Array.isArray(startedAudit)
        ? startedAudit as { auditId?: unknown; created?: unknown }
        : {};
      if (beginError || typeof started.auditId !== "string") {
        throw new Error(beginError?.message || "Destiny could not create the audit record.");
      }
      auditId = started.auditId;
      if (started.created !== true) {
        return json({ auditId, status: "running", progress: 10, resultsPath: `/audits/${auditId}`, resumed: true }, 202);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Destiny could not complete the audit.";
      return json({ error: message }, 502);
    }

    const backgroundAudit = async () => {
      try {
        const result = await runSeoAudit({
          website: website.url,
          locationName: typeof body.locationName === "string" ? body.locationName : undefined,
          login,
          password,
          businessContext: {
            productsServices: website.products_services,
            idealCustomer: website.ideal_customer,
            market: website.market,
          },
        });
        const logic = await runDestinyLogic({
          auditComplete: 1,
          criticalIssues: result.metrics.criticalIssues,
          rankingKeywords: result.metrics.rankingKeywords,
          contentGaps: result.metrics.contentGaps,
          reviewCount: result.metrics.reviewCount,
        });

        const { error: finalizeError } = await context.supabaseAdmin.rpc(
          "finalize_destiny_audit",
          {
            p_audit_id: auditId,
            p_user_id: userId,
            p_metrics: { ...result.metrics, referringDomains: 0 },
            p_provider_result: result,
            p_growth_stage: logic.growthStage,
            p_quest_title: logic.weeklyQuest,
            p_quest_category: questCategory(logic.weeklyQuest),
          },
        );
        if (finalizeError) throw new Error(finalizeError.message);

        await sendAuditReadyEmail({
          auditId,
          firstName: profile?.first_name ?? "",
          recipient: profile?.contact_email ?? "",
          domain: result.domain,
          weeklyQuest: logic.weeklyQuest,
        }).catch((emailCause) => {
          console.error("Audit-ready email failed", emailCause instanceof Error ? emailCause.message : "Unknown error");
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Destiny could not complete the audit.";
        await context.supabaseAdmin.rpc("fail_destiny_audit", {
          p_audit_id: auditId,
          p_user_id: userId,
          p_failure_message: message,
        });
        console.error("Background Destiny audit failed", message);
      }
    };

    EdgeRuntime.waitUntil(backgroundAudit());
    return json({
      auditId,
      status: "running",
      progress: 10,
      resultsPath: `/audits/${auditId}`,
    }, 202);
  }),
};
