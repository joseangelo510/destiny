export type WebsiteSelection = { capacity: number; selected: string[]; websites: { id: string; name: string; domain: string }[] };
export function parseWebsiteSelection(value: unknown): WebsiteSelection | null {
  if (!value || typeof value !== "object") return null;
  const data = value as WebsiteSelection;
  if (![1, 3, 10].includes(data.capacity) || !Array.isArray(data.selected) || !data.selected.every(id => typeof id === "string")
    || !Array.isArray(data.websites) || !data.websites.every(site => site && [site.id, site.name, site.domain].every(part => typeof part === "string"))) return null;
  return data;
}
