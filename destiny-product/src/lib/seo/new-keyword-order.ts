import type { BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";
import type { RankedKeywordOpportunity } from "./keyword-opportunity";
const angle = /\b(how|why|what|when|vs|versus|compare|comparison|alternatives?|guide|checklist|strateg(?:y|ies)|tips|examples?|mistakes?|cost|pricing|prices?|budget|roi|benchmarks?|statistics|trends|audit|template|planning|measurement|analytics|tracking|attribution|not|fix|improve|increase|reduce|benefits|types|structure|reporting|retargeting|targeting|conversion|funnel|engagement|implementation|compliance)\b/i;
const words = (text: string) => text.toLowerCase().replace(/\b(?:what|is|the|a|an|for|of|in|to|and|with|your|how|does|do|free|much)\b/g, " ").replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean).map(word => word.replace(/ies$/, "y").replace(/s$/, ""));
export function sameContentTopic(left: string, right: string, brief?: BusinessSearchBrief) {
  const identity = (text: string) => [...new Set(words(/\b(?:cost|price|prices|pricing)\b/i.test(text) ? text.replace(/\b(?:low|cheap|affordable)\b/gi, "") : text).map(word => /^(service|agency|agencie|company|companie)$/.test(word) ? "provider" : /^(cost|price|pricing|rate)$/.test(word) ? "pricing" : word))].filter(word => word !== "provider").sort().join(" ");
  if (identity(left) === identity(right)) return true;
  const family = (value: string) => /\bstrateg(?:y|ies)\b/i.test(value) ? "strategy" : /\bchecklist\b/i.test(value) ? "checklist" : /\bexamples?\b/i.test(value) ? "examples" : /\bguide\b|how (?:does .* work|to (?:run|manage|set up|start))/i.test(value) ? "guide" : "";
  const leftFamily = family(left);
  return Boolean(leftFamily && leftFamily === family(right) && brief?.offerVsEnablement.whatCompanySells.some(offer => {
    const core = words(offer.match(/\(([^)]+)\)/)?.[1] ?? offer).filter(word => !/^(service|agency|management|repair)$/.test(word));
    return core.length >= 2 && core.every(term => words(left).includes(term) && words(right).includes(term));
  }));
}
export function hasContentAngle(keyword: string, brief?: BusinessSearchBrief) {
  if (/\b(certifications?|certificates?|courses?|exams?|jobs?|salary|salaries)\b/i.test(keyword) || /^(?!what |how |why |when |which )\w+ (?:is|wants|needs|has)\b/i.test(keyword)) return false;
  let remaining = keyword.toLowerCase();
  for (const offer of brief?.offerVsEnablement.whatCompanySells ?? []) {
    const core = words(offer.match(/\(([^)]+)\)/)?.[1] ?? offer).filter(word => !/^(service|agency|management|repair)$/.test(word));
    if (core.every(term => words(keyword).includes(term))) {
      remaining = words(remaining).filter(term => !core.includes(term)).join(" ");
    }
  }
  return angle.test(remaining) && !/\b(?:agenc(?:y|ies)|services?|companies|company|consultants?|near me)\b/i.test(remaining) || /\b(?:cost|pricing|prices?|how|why|vs|versus|compare|comparison)\b/i.test(keyword);
}

export function orderNewContentTopics<T extends RankedKeywordOpportunity>(ranked: T[], brief: BusinessSearchBrief): T[] {
  const groups = new Map<string, T[]>();
  for (const keyword of [...ranked].sort((a, b) => Number(hasContentAngle(b.keyword, brief)) - Number(hasContentAngle(a.keyword, brief)))) {
    const terms = new Set(words(keyword.keyword));
    const offer = brief.offerVsEnablement.whatCompanySells.map(label => ({ label, terms: words(label.match(/\(([^)]+)\)/)?.[1] ?? label).filter(word => !/^(service|agency|management|repair)$/.test(word)) }))
      .filter(offer => offer.terms.length && offer.terms.every(term => terms.has(term))).sort((a, b) => b.terms.length - a.terms.length)[0];
    const group = offer?.label ?? keyword.themeLabel;
    const queue = groups.get(group) ?? [];
    queue.push({ ...keyword, themeLabel: group, themeId: offer ? `offer-${offer.terms.join("-")}` : keyword.themeId }); groups.set(group, queue);
  }
  const result: T[] = [];
  // Interleave topics without sorting back to high-volume service phrases.
  while ([...groups.values()].some(queue => queue.length)) {
    for (const queue of groups.values()) {
      const keyword = queue.shift();
      if (keyword) result.push(keyword);
    }
  }
  return result;
}
