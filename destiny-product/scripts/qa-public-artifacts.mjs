import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyPublicArtifactManifest } from "../qa/support/public-artifact-verifier.mjs";

const manifestPath = process.argv[2] || process.env.QA_PUBLIC_ARTIFACTS_MANIFEST;
if (!manifestPath) {
  throw new Error("Pass a public-artifact manifest path or set QA_PUBLIC_ARTIFACTS_MANIFEST.");
}

const absolutePath = path.resolve(process.cwd(), manifestPath);
const manifest = JSON.parse(await readFile(absolutePath, "utf8"));
const evidence = await verifyPublicArtifactManifest(manifest);
process.stdout.write(`${JSON.stringify({
  state: "PUBLIC_ARTIFACTS_VERIFIED",
  checkedAt: new Date().toISOString(),
  manifest: absolutePath,
  evidence,
}, null, 2)}\n`);
