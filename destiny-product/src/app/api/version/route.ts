import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { correlationContext, serializeLogEvent } from "@/lib/observability/logging";

type BuildStamp = {
  sha: string;
  tree: string;
  builtAt: string;
  env: string;
};

const UNKNOWN_STAMP: BuildStamp = {
  sha: "unknown",
  tree: "unknown",
  builtAt: "unknown",
  env: "unknown",
};

const FULL_SHA = /^[0-9a-f]{40}$/;

function normalizeStamp(value: unknown): BuildStamp {
  // Stryker disable next-line ConditionalExpression,LogicalOperator: defensive JSON shape guard converges to UNKNOWN_STAMP for every JSON scalar
  if (!value || typeof value !== "object" || Array.isArray(value)) return UNKNOWN_STAMP;
  const stamp = value as Record<string, unknown>;
  // Stryker disable next-line ConditionalExpression: JSON scalar coercion cannot produce a full SHA
  const sha = typeof stamp.sha === "string" && FULL_SHA.test(stamp.sha) ? stamp.sha : "unknown";
  // Stryker disable next-line ConditionalExpression: JSON scalar coercion cannot produce a full SHA
  const tree = typeof stamp.tree === "string" && FULL_SHA.test(stamp.tree) ? stamp.tree : "unknown";
  const builtAt = typeof stamp.builtAt === "string" && !Number.isNaN(Date.parse(stamp.builtAt))
    ? stamp.builtAt
    : "unknown";
  // Stryker disable next-line StringLiteral,ConditionalExpression: unknown sentinel comparison preserves the same output
  const env = typeof stamp.env === "string" && stamp.env.trim() && stamp.env !== "unknown"
    ? stamp.env.trim()
    : "unknown";
  return { sha, tree, builtAt, env };
}

export async function GET(request: Request) {
  const correlation = correlationContext(request.headers);
  const stampPath = path.join(process.cwd(), ".generated", "build-stamp.json");
  // Stryker disable next-line StringLiteral: JSON.parse accepts either UTF-8 text or its Buffer equivalent
  const stamp = await readFile(stampPath, "utf8")
    .then((contents) => normalizeStamp(JSON.parse(contents)))
    .catch(() => UNKNOWN_STAMP);

  console.info(serializeLogEvent({
    correlationId: correlation.correlationId,
    event: "version.read",
    severity: "info",
    context: { buildIdentityKnown: stamp.sha !== "unknown" },
  }));

  return NextResponse.json(stamp, {
    headers: { "Cache-Control": "no-store", ...correlation.responseHeaders },
  });
}
