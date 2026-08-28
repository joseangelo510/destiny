const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${iso}`);
  }
  return date;
}

export function formatUtcDate(iso: string) {
  const date = parseDate(iso);
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatUtcDateTime(iso: string) {
  const date = parseDate(iso);
  const hour = date.getUTCHours();
  const displayHour = hour % 12 || 12;
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  return `${formatUtcDate(iso)}, ${displayHour}:${minute} ${period} UTC`;
}
