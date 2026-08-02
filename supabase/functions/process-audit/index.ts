import { withSupabase } from "@supabase/server";
import { sendAuditReadyEmail } from "./email.ts";
import { runDestinyLogic } from "./logic.ts";
import { runSeoAudit } from "./seo.ts";

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

type AuditRequest = {
  websiteId?: unknown;
  locationName?: unknown;
};

const LOGOS_RULES_VERSION = "2026-08-01.7";

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildWeeklyTasks(result: Awaited<ReturnType<typeof runSeoAudit>>, auditId: string, primaryQuest: string, primaryCategory: string, manifest: string[]) {
  const contentKeyword = result.keywords.find((keyword) => keyword.essential)?.keyword
    ?? result.keywords.find((keyword) => keyword.verdict === "accept")?.keyword
    ?? result.keywords.find((keyword) => keyword.verdict === "review")?.keyword
    ?? "your strongest search opportunity";
  const reddit = result.distributionOpportunities?.find((item) => item.platform === "Reddit");
  const quora = result.distributionOpportunities?.find((item) => item.platform === "Quora");
  const tasks = {
    vocabulary_review: { title: "Confirm Destiny understands your business", why: "Check the business, audience, problem, goals, and differentiator Destiny will use to guide every recommendation.", category: "measurement", taskType: "business_confirmation", actionPath: `/audits/${auditId}#business-understanding`, estimatedMinutes: 2, requiresApproval: true, minPlanTier: 1, priority: 1, xp: 20 },
    content_review: { title: `Review and approve the “${contentKeyword}” article`, why: "A human approval gate keeps the article accurate before it can move to a connected CMS.", category: "content", taskType: "content_review", actionPath: "/content", estimatedMinutes: 15, requiresApproval: true, minPlanTier: 1, priority: 1, xp: 30 },
    primary_quest: { title: primaryQuest, why: "LOGOS selected this as the highest-impact action from the latest audit.", category: primaryCategory, taskType: "primary_quest", actionPath: `/audits/${auditId}`, estimatedMinutes: 10, requiresApproval: false, minPlanTier: 1, priority: 1, xp: 25 },
    reddit_distribution: { title: reddit ? `Contribute to: ${reddit.title}` : "Review this week's Reddit opportunity", why: "A useful answer in a current thread can earn qualified referral visibility without automated posting.", category: "distribution", taskType: "distribution", actionPath: "/distribution", externalUrl: reddit?.url, estimatedMinutes: 15, requiresApproval: true, minPlanTier: 2, priority: 2, xp: 25 },
    keyword_review: { title: "Review your essential competitor keyword gaps", why: "These phrases match your site vocabulary and are covered by at least two competitors.", category: "content", taskType: "keyword_review", actionPath: "/keywords", estimatedMinutes: 15, requiresApproval: true, minPlanTier: 2, priority: 2, xp: 25 },
    quora_distribution: { title: quora ? `Answer: ${quora.title}` : "Review this week's Quora opportunity", why: "Answering a real question makes your expertise visible where people are already researching.", category: "distribution", taskType: "distribution", actionPath: "/distribution", externalUrl: quora?.url, estimatedMinutes: 15, requiresApproval: true, minPlanTier: 3, priority: 3, xp: 25 },
    reviews: { title: "Ask three recent customers for a review", why: "Fresh first-party proof improves trust and supports local search conversion.", category: "reviews", taskType: "reviews", actionPath: "/reviews", estimatedMinutes: 15, requiresApproval: false, minPlanTier: 3, priority: 3, xp: 25 },
    llm_visibility: { title: "Review your LLM visibility and cited-domain gap", why: "See whether AI answers mention your company and which sources they cite instead.", category: "measurement", taskType: "measurement", actionPath: "/llm-visibility", estimatedMinutes: 15, requiresApproval: false, minPlanTier: 3, priority: 3, xp: 25 },
  };
  return manifest.map((code) => tasks[code as keyof typeof tasks]).filter(Boolean);
}

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

    const [{ data: website, error: websiteError }, { data: profile }, { data: knownCompetitors }] = await Promise.all([
      context.supabase
        .from("websites")
        .select("id,url,normalized_domain,products_services,problem_solved,ideal_customer,audience_challenges_goals,market")
        .eq("id", body.websiteId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("first_name,contact_email")
        .eq("id", userId)
        .maybeSingle(),
      context.supabase
        .from("competitors")
        .select("name,url")
        .eq("website_id", body.websiteId),
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
            problemSolved: website.problem_solved,
            idealCustomer: website.ideal_customer,
            audienceChallengesGoals: website.audience_challenges_goals,
            market: website.market,
          },
          knownCompetitors: knownCompetitors ?? [],
          onProgress: async (progress) => {
            await context.supabaseAdmin.from("audits").update({ progress }).eq("id", auditId).eq("status", "running");
          },
        });
        const logicInput = {
          auditComplete: 1,
          criticalIssues: result.metrics.criticalIssues,
          warnings: result.metrics.warnings,
          rankingKeywords: result.metrics.rankingKeywords,
          newKeywords: result.metrics.newKeywords,
          lostKeywords: result.metrics.lostKeywords,
          contentGaps: result.metrics.contentGaps,
          reviewCount: result.metrics.reviewCount,
          planTier: 3 as const,
        };
        const logic = await runDestinyLogic(logicInput);
        const weeklyTasks = buildWeeklyTasks(result, auditId, logic.weeklyQuest, logic.questCategory, logic.weeklyTaskManifest);
        if (weeklyTasks.length !== logic.weeklyTaskCount) {
          throw new Error("LOGOS task quota did not match the generated weekly plan.");
        }
        const logicInputHash = await sha256(logicInput);

        const { error: finalizeError } = await context.supabaseAdmin.rpc(
          "finalize_destiny_audit_v2",
          {
            p_audit_id: auditId,
            p_user_id: userId,
            p_metrics: { ...result.metrics, referringDomains: 0 },
            p_provider_result: {
              ...result,
              destinyDecision: logic,
              logosTrace: { rulesVersion: LOGOS_RULES_VERSION, inputHash: logicInputHash, input: logicInput, output: logic },
            },
            p_growth_stage: logic.growthStage,
            p_tasks: weeklyTasks,
            p_rules_version: LOGOS_RULES_VERSION,
            p_logic_input_hash: logicInputHash,
          },
        );
        if (finalizeError) throw new Error(finalizeError.message);

        await context.supabaseAdmin
          .from("notifications")
          .update({
            title: "Your Destiny results are ready",
            body: "Review the clearest opportunity, confirm Destiny understands your business, and start your first guided task.",
            destination_path: `/audits/${auditId}`,
          })
          .eq("user_id", userId)
          .eq("kind", "audit_ready")
          .eq("destination_path", "/this-week");

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
