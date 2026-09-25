import { withSupabase } from "@supabase/server";
import { authEmailVerification } from "../_shared/billing/verified-user.ts";
import { notificationRecipient } from "../notification-recipient.ts";
import { sendAuditReadyEmailWithRetry, withEmailDelivery } from "./email.ts";
import { runDestinyLogic } from "./logic.ts";
import { auditReadyNotificationCopy } from "./notifications.ts";
import { assertRecommendationManifest, encodeAuditIssues } from "./recommendation-policy.ts";
import { runSeoAudit } from "./seo.ts";

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

type AuditRequest = {
  websiteId?: unknown;
  locationName?: unknown;
};

const LOGOS_RULES_VERSION = "2026-08-04.4";

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildWeeklyTasks(result: Awaited<ReturnType<typeof runSeoAudit>>, auditId: string, logic: Awaited<ReturnType<typeof runDestinyLogic>>) {
  const tasks = {
    keyword_review: { title: "Approve or decline your initial keyword strategy", why: "Rebound SEO completed the research; your decision keeps the content plan focused on searches that match your real business.", category: "content", taskType: "keyword_review", actionPath: "/keywords", estimatedMinutes: 12, xp: 25 },
    primary_quest: { title: logic.weeklyQuest, why: logic.explanation, category: logic.questCategory, taskType: "primary_quest", actionPath: logic.questCategory === "reviews" ? "/reviews" : `/audits/${auditId}#recommended-fix`, estimatedMinutes: 15, xp: 25 },
    content_review: { title: "Review and approve three articles for this week", why: "Each article is editable, connected to an approved keyword, and stays behind a human accuracy gate before CMS or document delivery.", category: "content", taskType: "content_review", actionPath: "/content", estimatedMinutes: 35, xp: 45 },
    community_distribution: { title: "Reply to three relevant Reddit or Quora discussions", why: "Helpful answers in live conversations can earn qualified referral visibility without automated posting.", category: "distribution", taskType: "community_distribution", actionPath: "/distribution#community", estimatedMinutes: 35, xp: 35 },
    social_distribution: { title: "Share this week's approved article on LinkedIn and X", why: "Founder context and distribution help approved content reach people who already trust your perspective.", category: "distribution", taskType: "social_distribution", actionPath: "/distribution#social", estimatedMinutes: 15, xp: 25 },
    publisher_outreach: { title: "Review three niche creators covering your priority topics", why: "A relevant creator, author, or specialist publication can earn qualified referral traffic and future authority.", category: "distribution", taskType: "publisher_outreach", actionPath: "/distribution#outreach", estimatedMinutes: 30, xp: 35 },
    directory_growth: { title: "Complete one directory profile or request three reviews", why: "Product Hunt, G2, Capterra, and Google Business Profile help buyers compare options; established profiles should build fresh proof.", category: "distribution", taskType: "directory_growth", actionPath: "/distribution#directories", estimatedMinutes: 25, xp: 30 },
    technical_review: { title: "Run a PageSpeed and deeper technical check", why: "Rebound SEO keeps onboarding fast by checking the homepage first. This follow-up reviews performance and the wider technical foundation after your initial strategy is ready.", category: "technical", taskType: "technical_review", actionPath: `/audits/${auditId}#technical-evidence`, externalUrl: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://${result.domain}`)}`, estimatedMinutes: 20, xp: 25 },
  };
  assertRecommendationManifest(logic);
  return logic.weeklyTaskManifest.map((code, index) => ({
    ...tasks[code as keyof typeof tasks],
    requiresApproval: logic.weeklyTaskApprovals[index],
    minPlanTier: logic.weeklyTaskTiers[index],
    priority: logic.weeklyTaskPriorities[index],
  })).filter((task) => task.title);
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

    const [{ data: website, error: websiteError }, { data: profile }, { data: knownCompetitors }, { data: keywordPreferences }] = await Promise.all([
      context.supabase
        .from("websites")
        .select("id,url,normalized_domain,business_name,products_services,problem_solved,ideal_customer,audience_challenges_goals,differentiation,market,notification_email,organizations!inner(owner_id)")
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
      context.supabase
        .from("keyword_preferences")
        .select("normalized_keyword,decision,reason,updated_at")
        .eq("website_id", body.websiteId),
    ]);

    if (websiteError || !website) {
      return json({ error: "You do not have access to that website." }, 403);
    }

    const login = Deno.env.get("DATAFORSEO_LOGIN")?.trim();
    const password = Deno.env.get("DATAFORSEO_PASSWORD")?.trim();
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
    const keywordModel = Deno.env.get("ANTHROPIC_KEYWORD_MODEL")?.trim() || "claude-opus-4-8";
    const provider = login && password ? "dataforseo" : "demo";
    const billingMode = Deno.env.get("BILLING_MODE");
    if (billingMode !== "test" && billingMode !== "live") return json({ error: "Audit billing setup is not complete." }, 503);
    const organization = Array.isArray(website.organizations) ? website.organizations[0] : website.organizations;
    const ownerId = typeof organization?.owner_id === "string" ? organization.owner_id : null;
    if (!ownerId) return json({ error: "You do not have access to that website." }, 403);
    const actorVerification = await authEmailVerification(context.supabaseAdmin, userId);
    const ownerVerification = ownerId === userId ? actorVerification : await authEmailVerification(context.supabaseAdmin, ownerId);
    if (actorVerification === "unavailable" || ownerVerification === "unavailable") {
      return json({ error: "Sign-in verification is temporarily unavailable. Try again shortly.", code: "BILLING_VERIFICATION_UNAVAILABLE" }, 503);
    }
    if (actorVerification !== "verified" || ownerVerification !== "verified") {
      return json({ error: "Verify your sign-in email before starting an audit.", code: "BILLING_VERIFICATION_REQUIRED", billingUrl: "/account/billing" }, 403);
    }
    let auditId: string;
    let usageId: string;
    try {
      const { data: startedAudit, error: beginError } = await context.supabaseAdmin.rpc(
        "begin_billed_audit_v2",
        { p_website_id: website.id, p_user_id: userId, p_provider: provider, p_livemode: billingMode === "live", p_actor_verified: true, p_owner_verified: true, p_verified_owner_id: ownerId },
      );
      const started = startedAudit && typeof startedAudit === "object" && !Array.isArray(startedAudit)
        ? startedAudit as { auditId?: unknown; created?: unknown; allowed?: unknown; reason?: unknown; usageId?: unknown }
        : {};
      if (!beginError && started.allowed === false) {
        const verification = started.reason === "verification_required";
        const unavailable = started.reason === "website_unavailable";
        const limited = started.reason === "limit_reached";
        const unmanaged = started.reason === "managed_website_required";
        return json({
          error: verification ? "Verify your sign-in email before starting an audit."
            : unavailable ? "You do not have access to that website."
            : unmanaged ? "The website owner must select this site under Managed websites in billing before starting another audit."
            : limited ? "You've used this plan's audit allowance. Upgrade or wait for your next billing period."
            : "Your initial audit is already used. Choose a plan to run more research.",
          code: unmanaged ? "BILLING_MANAGED_WEBSITE_REQUIRED" : verification ? "BILLING_VERIFICATION_REQUIRED" : limited ? "BILLING_LIMIT_REACHED" : "BILLING_PAYMENT_REQUIRED",
          billingUrl: "/account/billing",
        }, verification || unavailable ? 403 : 402);
      }
      if (beginError || typeof started.auditId !== "string") {
        throw new Error(beginError?.message || "Rebound SEO could not create the audit record.");
      }
      if (started.allowed !== true) throw new Error("Audit access could not be verified.");
      auditId = started.auditId;
      if (started.created !== true) {
        return json({ auditId, status: "running", progress: 10, resultsPath: `/audits/${auditId}`, resumed: true }, 202);
      }
      if (typeof started.usageId !== "string") throw new Error("Audit usage could not be reserved.");
      usageId = started.usageId;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Rebound SEO could not complete the audit.";
      return json({ error: message }, 502);
    }

    const backgroundAudit = async () => {
      let succeeded = false;
      try {
        const result = await runSeoAudit({
          website: website.url,
          locationName: typeof body.locationName === "string" ? body.locationName : undefined,
          login,
          password,
          businessContext: {
            businessName: website.business_name,
            productsServices: website.products_services,
            problemSolved: website.problem_solved,
            idealCustomer: website.ideal_customer,
            audienceChallengesGoals: website.audience_challenges_goals,
            differentiation: website.differentiation,
            market: website.market,
          },
          knownCompetitors: (knownCompetitors ?? []).slice(0, 5),
          strategyModel: {
            apiKey: anthropicApiKey,
            model: keywordModel,
            timeoutMs: 45_000,
          },
          keywordPreferences: (keywordPreferences ?? []).flatMap((preference) => {
            if (preference.decision !== "approved" && preference.decision !== "declined") return [];
            return [{
              normalizedKeyword: preference.normalized_keyword,
              decision: preference.decision,
              reason: preference.reason,
              updatedAt: preference.updated_at,
            }];
          }),
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
          ...encodeAuditIssues(result.issues),
        };
        const logic = await runDestinyLogic(logicInput);
        console.info(JSON.stringify({
          event: "logos_recommendation_policy",
          questSource: logic.questSource,
          issueQuestCode: logic.issueQuestCode,
          tasks: logic.weeklyTaskCount,
          fallbacks: 0,
        }));
        const weeklyTasks = buildWeeklyTasks(result, auditId, logic);
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
        succeeded = true;

        const readyNotification = auditReadyNotificationCopy(result.domain);
        await context.supabaseAdmin
          .from("notifications")
          .update({
            title: readyNotification.title,
            body: readyNotification.body,
            destination_path: `/audits/${auditId}`,
            website_id: website.id,
          })
          .eq("user_id", userId)
          .eq("kind", "audit_ready")
          .eq("destination_path", "/this-week");

        const emailDelivery = await sendAuditReadyEmailWithRetry({
          auditId,
          firstName: profile?.first_name ?? "",
          recipient: notificationRecipient(website.notification_email, profile?.contact_email),
          domain: result.domain,
          weeklyQuest: logic.weeklyQuest,
        });
        if (emailDelivery.status === "sent") {
          console.log("Audit-ready email sent", { auditId, messageId: emailDelivery.messageId ?? null });
        } else {
          console.error("Audit-ready email not delivered", { auditId, status: emailDelivery.status, reason: emailDelivery.reason ?? "Unknown reason" });
        }
        const { data: savedMetrics } = await context.supabaseAdmin
          .from("audit_metrics")
          .select("raw_provider_payload")
          .eq("audit_id", auditId)
          .maybeSingle();
        const { error: emailStatusError } = await context.supabaseAdmin
          .from("audit_metrics")
          .update({ raw_provider_payload: withEmailDelivery(savedMetrics?.raw_provider_payload, emailDelivery) })
          .eq("audit_id", auditId);
        if (emailStatusError) console.error("Audit email delivery status could not be saved", { auditId, reason: emailStatusError.message });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Rebound SEO could not complete the audit.";
        await context.supabaseAdmin.rpc("fail_destiny_audit", {
          p_audit_id: auditId,
          p_user_id: userId,
          p_failure_message: message,
        });
        console.error("Background Rebound SEO audit failed", message);
      } finally {
        const { error: settlementError } = await context.supabaseAdmin.rpc("finish_billing_usage", {
          p_id: usageId, p_succeeded: succeeded, p_provider_cost_usd: null,
        });
        if (settlementError) console.error("Audit usage confirmation pending", { auditId });
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
