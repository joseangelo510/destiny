import { themeSeeds, type BusinessSearchBrief } from "../../../supabase/functions/process-audit/business-search-brief";

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim();
const usable = (value: string) => value.length >= 3 && value.split(" ").length <= 7 && !/\b(team|years|experience|track record|specialzie|five[- ]star|customers include)\b/.test(value);
const root = (value: string) => clean(value.match(/\(([^)]+)\)/)?.[1] ?? value).replace(/\b(?:services?|agency|management|repair|and)\b/g, " ").replace(/\s+/g, " ").trim();

// Structured offers recover topics omitted from older theme lists. Each queue
// gets a turn before another seed from the same field; no user-specific phrases.
export function keywordDiscoverySeeds(brief: BusinessSearchBrief, limit = 24) {
  const offers = brief.offerVsEnablement.whatCompanySells.map(root).filter(usable);
  const themes = themeSeeds(brief, 40).map(clean).filter(usable);
  const problems = [...brief.problems, ...brief.offerVsEnablement.whatProductEnables].map(clean).filter(usable);
  const audiences = brief.audiences.map(value => clean(value).replace(/\b(companies|firms|teams)\b/g, "").trim()).filter(value => value.split(" ").length <= 3);
  const differentiated = brief.differentiators.map(value => clean(value).replace(/^speciali[sz]ation in /, "")).filter(usable);
  const queues = [offers, themes, problems, differentiated, offers.flatMap(offer => audiences.map(audience => `${offer} for ${audience}`)).filter(usable)];
  const result: string[] = [];
  const seen = new Set<string>();
  while (result.length < limit && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      const seed = queue.shift();
      if (!seed || seen.has(seed)) continue;
      seen.add(seed); result.push(seed);
      if (result.length === limit) break;
    }
  }
  return result;
}
