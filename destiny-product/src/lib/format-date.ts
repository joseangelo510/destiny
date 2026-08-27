const utcDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const utcDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatUtcDate(iso: string) {
  return utcDate.format(new Date(iso));
}

export function formatUtcDateTime(iso: string) {
  return `${utcDateTime.format(new Date(iso))} UTC`;
}
