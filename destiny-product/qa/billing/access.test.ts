import { describe, expect, it } from "vitest";
import { billingAccess, planById, trialLimits } from "@/lib/billing/plans";

const now = Date.parse("2026-09-12T12:00:00Z");
const future = "2026-09-13T12:00:00Z";
const past = "2026-09-11T12:00:00Z";
const paid = { plan: "growth", status: "active", periodStart: past, periodEnd: future, paidThrough: future, trialEnd: null, cancelAtPeriodEnd: false };

describe("subscription work access", () => {
  it("keeps saved work available without authorizing provider work", () => {
    expect(billingAccess(null, now)).toMatchObject({ canReadSaved: true, canRunPaidWork: false, reason: "choose_plan" });
  });
  it("does not treat an active subscription or a checkout redirect as proof of payment", () => {
    expect(billingAccess({ ...paid, paidThrough: null }, now).canRunPaidWork).toBe(false);
  });
  it("requires a known plan and a valid current paid period", () => {
    expect(billingAccess(paid, now).canRunPaidWork).toBe(true);
    for (const change of [{ plan: "enterprise" }, { periodEnd: past }, { paidThrough: past }, { periodStart: future }, { periodStart: "invalid" }]) {
      expect(billingAccess({ ...paid, ...change }, now).canRunPaidWork).toBe(false);
    }
  });
  it("stops new work on payment failure, pause, immediate cancellation and unpaid states", () => {
    for (const status of ["past_due", "unpaid", "paused", "canceled", "incomplete", "incomplete_expired"]) {
      expect(billingAccess({ ...paid, status }, now).canRunPaidWork).toBe(false);
    }
  });
  it("honors already-paid time for cancellation at period end", () => {
    expect(billingAccess({ ...paid, cancelAtPeriodEnd: true }, now).canRunPaidWork).toBe(true);
    expect(billingAccess({ ...paid, cancelAtPeriodEnd: true }, Date.parse(future)).canRunPaidWork).toBe(false);
  });
  it("expires trial exactly at its boundary and uses a separate bounded trial pool", () => {
    const trial = { ...paid, status: "trialing", trialEnd: future, paidThrough: null };
    expect(billingAccess(trial, now)).toMatchObject({ canRunPaidWork: true, limits: trialLimits });
    expect(billingAccess(trial, Date.parse(future))).toMatchObject({ canRunPaidWork: false, reason: "trial_ended" });
    expect(billingAccess({ ...trial, trialEnd: "bad" }, now).canRunPaidWork).toBe(false);
  });
  it("does not let website count multiply pooled plan allowances", () => {
    expect(planById("premium")?.limits).toMatchObject({ websites: 10, articles: 40, trackedTargets: 200 });
    expect(planById("growth")?.monthlyCents).toBe(9900);
    expect(planById("starter")?.limits.infographics).toBe(0);
    expect(planById("__proto__")).toBeNull();
  });
});
