import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requiredFields = [
  "date", "shipped commit SHA", "tag", "PR links", "gate run link", "summary counts",
  "RED evidence links", "commit discipline", "isolation matrix", "test-change",
  "migrations", "features and blast radius", "rollback command", "deployer",
  "post-deploy smoke", "legacy-evidence",
];

const log = await readFile(path.join(root, "DEPLOY_LOG.md"), "utf8");
const lower = log.toLocaleLowerCase();
const missing = requiredFields.filter((field) => !lower.includes(field.toLocaleLowerCase()));
if (missing.length) {
  process.stderr.write(`DEPLOY_LOG.md is missing required fields: ${missing.join(", ")}\n`);
  process.exitCode = 1;
}

for (const release of log.split(/^## Release:/m).slice(1)) {
  const section = release.split(/^## /m)[0];
  const empty = requiredFields.filter((field) => {
    const match = section.match(new RegExp(`^- ${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.*)$`, "im"));
    return !match || !match[1].trim() || /^(?:todo|tbd|pending|n\/a)$/i.test(match[1].trim());
  });
  if (empty.length) {
    process.stderr.write(`Release entry has empty fields: ${empty.join(", ")}\n`);
    process.exitCode = 1;
  }
}
