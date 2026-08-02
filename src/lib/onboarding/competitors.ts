import { normalizeWebsite } from "../seo/url";

export type CompetitorEntry = {
  name: string;
  url: string | null;
  domain: string | null;
};

function parseLine(value: string): CompetitorEntry | null {
  const line = value.trim();
  if (!line) return null;
  const parts = line.split(/\s+(?:—|–|-|\|)\s+/).map((part) => part.trim()).filter(Boolean);
  const websiteCandidate = parts.find((part) => /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(part));
  if (websiteCandidate) {
    try {
      const website = normalizeWebsite(websiteCandidate);
      const name = parts.find((part) => part !== websiteCandidate) || website.domain;
      return { name: name.slice(0, 160), url: website.url, domain: website.domain };
    } catch {
      // Preserve the human-entered name below if the URL-shaped value is invalid.
    }
  }
  return { name: line.slice(0, 160), url: null, domain: null };
}

export function parseCompetitorEntries(value: string): CompetitorEntry[] {
  const seen = new Set<string>();
  const entries: CompetitorEntry[] = [];
  for (const raw of value.split(/\r?\n|;/)) {
    const entry = parseLine(raw);
    if (!entry) continue;
    const identity = (entry.domain || entry.name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    entries.push(entry);
    if (entries.length === 10) break;
  }
  return entries;
}

export function validateCompetitorEntries(value: string) {
  const count = parseCompetitorEntries(value).length;
  return count >= 2
    ? { ready: true, count, error: "" }
    : { ready: false, count, error: "Add at least two competitors so Destiny can find meaningful gaps." };
}
