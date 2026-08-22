import { spawnSync } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
const command = pnpmCli ? process.execPath : "pnpm";
const args = pnpmCli
  ? [pnpmCli, "audit", "--prod", "--audit-level=high"]
  : ["audit", "--prod", "--audit-level=high"];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
