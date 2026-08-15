function normalizedEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
}

export function notificationRecipient(websiteEmail: unknown, profileEmail: unknown) {
  return normalizedEmail(websiteEmail) || normalizedEmail(profileEmail);
}
