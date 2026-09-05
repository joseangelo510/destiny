import { DEFAULT_ARTICLE_PREFERENCES } from "./article-generation";

// The shared writer already persists this brief. Hydrate its direction without
// changing that writer or overwriting preferences edited in Content Studio.
export function restoreKeywordDraftBrief(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const draft = value as Record<string, unknown>;
  if (draft.generationStatus !== "starter" || draft.body !== "" || draft.preferences) return value;
  const brief = draft.agentBrief as { angle?: unknown } | undefined;
  if (typeof brief?.angle !== "string" || !/^(Blog guide \/ FAQ|Service landing page|Comparison page) about /.test(brief.angle)) return value;
  return { ...draft, preferences: { ...DEFAULT_ARTICLE_PREFERENCES, specialInstructions: brief.angle } };
}
