import { spawnSync } from "node:child_process";

export function runIsolationSql(databaseContainer: string, sql: string) {
  return spawnSync("docker", [
    "exec", "-i", databaseContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
  ], {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  });
}
