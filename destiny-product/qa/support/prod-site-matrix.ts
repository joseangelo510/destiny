export type ProductionSiteCase = {
  websiteId: string;
  businessName: string;
  auditId: string;
};

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

export function parseProductionSiteMatrix(raw: string): ProductionSiteCase[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("QA_PROD_SITES_JSON must be valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("QA_PROD_SITES_JSON must contain at least one website.");
  const rows = parsed.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Site ${index + 1} must be an object.`);
    const row = value as Record<string, unknown>;
    return {
      websiteId: requiredString(row.websiteId, `Site ${index + 1} websiteId`),
      businessName: requiredString(row.businessName, `Site ${index + 1} businessName`),
      auditId: requiredString(row.auditId, `Site ${index + 1} auditId`),
    };
  });
  const ids = new Set<string>();
  const auditIds = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.websiteId)) throw new Error(`Duplicate website id in QA_PROD_SITES_JSON: ${row.websiteId}`);
    if (auditIds.has(row.auditId)) throw new Error(`Duplicate audit id in QA_PROD_SITES_JSON: ${row.auditId}`);
    ids.add(row.websiteId);
    auditIds.add(row.auditId);
  }
  return rows;
}
