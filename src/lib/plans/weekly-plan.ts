export type PlanTierId = "beginner" | "moderate" | "super_growth";

export const PLAN_TIERS = [
  { id: "beginner", label: "Beginner", taskCount: 3, minutes: 30, description: "Three focused actions with Destiny guiding every step." },
  { id: "moderate", label: "Moderate", taskCount: 5, minutes: 60, description: "A balanced weekly rhythm across content, optimization, and distribution." },
  { id: "super_growth", label: "Super Growth", taskCount: 8, minutes: 120, description: "The full growth loop for teams ready to move faster." },
] as const;
