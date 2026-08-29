export const BRAND_NAME = "Rebound SEO";
export const BRAND_INITIAL = "R";

export function displayGeneratedBy(value: string | undefined): string | undefined {
  return value === "Destiny Interviews" ? "Rebound SEO Interviews" : value;
}
