export type AuditKeyword = Record<string, unknown> & {
  keyword: string;
};

export function selectUsableAuditKeywords(value: unknown): AuditKeyword[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is AuditKeyword => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keyword = item as Record<string, unknown>;
    return typeof keyword.keyword === "string" && keyword.verdict !== "reject";
  });
}
