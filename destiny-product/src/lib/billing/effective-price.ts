export type EffectiveDiscount = {
  name: string; duration: "once" | "repeating" | "forever"; endsAt: string | null;
  percentOff: number | null; amountOffCents: number | null;
};
export type EffectiveBillingPrice = {
  currency: "usd"; catalogSubtotalCents: number; nextPaymentCents: number; nextPaymentAt: string;
  discounts: EffectiveDiscount[];
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" ? value as Record<string, unknown> : null;
const money = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export function parseEffectiveBillingPrice(value: unknown): EffectiveBillingPrice | null {
  const item = record(value);
  if (!item || item.currency !== "usd" || !money(item.catalogSubtotalCents) || !money(item.nextPaymentCents) || !date(item.nextPaymentAt) || !Array.isArray(item.discounts) || item.discounts.length > 3) return null;
  const discounts: EffectiveDiscount[] = [];
  for (const value of item.discounts) {
    const discount = record(value);
    if (!discount || typeof discount.name !== "string" || !discount.name.trim() || discount.name.length > 80 || !["once", "repeating", "forever"].includes(String(discount.duration)) || !(discount.endsAt === null || date(discount.endsAt)) || !(discount.percentOff === null || typeof discount.percentOff === "number" && discount.percentOff >= 0 && discount.percentOff <= 100) || !(discount.amountOffCents === null || money(discount.amountOffCents))) return null;
    discounts.push({ name: discount.name, duration: discount.duration as EffectiveDiscount["duration"], endsAt: discount.endsAt as string | null,
      percentOff: discount.percentOff as number | null, amountOffCents: discount.amountOffCents as number | null });
  }
  return { currency: "usd", catalogSubtotalCents: Number(item.catalogSubtotalCents), nextPaymentCents: Number(item.nextPaymentCents), nextPaymentAt: item.nextPaymentAt as string, discounts };
}
