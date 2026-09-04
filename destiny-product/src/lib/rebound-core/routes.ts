export const CORE_NAVIGATION = [
  { label: "Home", href: "/app/home", cadence: "every_day" },
  { label: "Content", href: "/app/content", cadence: "every_day" },
  { label: "Calendar", href: "/app/calendar", cadence: "every_day" },
  { label: "Distribution", href: "/app/distribution", cadence: "every_week" },
  { label: "Progress", href: "/app/progress", cadence: "every_week" },
] as const;

export function workspaceHomeDestination(websiteId: string) {
  return `/app/home?site=${encodeURIComponent(websiteId)}`;
}
