import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const manifestPath = path.join(productRoot, "qa", "inventory", "privileged-edge-functions.json");
const specificationPath = path.join(productRoot, "qa", "specs", "privileged-edge-functions.md");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

type Boundary =
  | "website_rls"
  | "account_claim"
  | "oauth_state"
  | "cron_secret"
  | "signed_token_or_cron";

type ManifestEntry = {
  path: string;
  auth: "user" | "none";
  boundary: Boundary;
};

function compact(source: string) {
  return source.replace(/\s+/g, " ").replace(/\s+\./g, ".");
}

async function privilegedFunctionPaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return privilegedFunctionPaths(absolute);
    if (entry.name !== "index.ts") return [];
    const source = await readFile(absolute, "utf8");
    return source.includes("context.supabaseAdmin")
      ? [path.relative(productRoot, absolute).split(path.sep).join("/")]
      : [];
  }));
  return paths.flat().sort();
}

async function manifest() {
  return JSON.parse(await readFile(manifestPath, "utf8")) as ManifestEntry[];
}

function handlerSource(source: string) {
  const start = source.indexOf("fetch: withSupabase");
  expect(start).toBeGreaterThanOrEqual(0);
  return compact(source.slice(start));
}

describe("privileged Edge Function authorization boundaries", () => {
  it("requires an explicit, executable inventory for every service-role function", async () => {
    expect(await exists(manifestPath)).toBe(true);
    expect(await exists(specificationPath)).toBe(true);

    const specification = await readFile(specificationPath, "utf8");
    expect(specification).toContain("request-controlled identifiers");
    expect(specification).toContain("negative authorization");
    expect(specification).toContain("service role");
  });

  it("fails closed when a service-role function is not registered", async () => {
    const registered = (await manifest()).map((entry) => entry.path).sort();
    const discovered = await privilegedFunctionPaths(path.join(productRoot, "supabase", "functions"));

    expect(registered).toEqual(discovered);
    expect(new Set(registered).size).toBe(registered.length);
  });

  it("requires the declared Supabase auth mode and a known boundary", async () => {
    const allowed = new Set<Boundary>([
      "website_rls",
      "account_claim",
      "oauth_state",
      "cron_secret",
      "signed_token_or_cron",
    ]);

    for (const entry of await manifest()) {
      const source = await readFile(path.join(productRoot, entry.path), "utf8");
      expect(source, `${entry.path} must use its declared auth mode.`)
        .toContain(`withSupabase({ auth: "${entry.auth}" }`);
      expect(source, `${entry.path} must actually use the service-role client.`)
        .toContain("context.supabaseAdmin");
      expect(allowed.has(entry.boundary), `${entry.path} has an unknown boundary.`).toBe(true);
    }
  });

  it("pins the Edge runtime dependency beside every privileged function", async () => {
    for (const entry of await manifest()) {
      const denoConfigPath = path.join(productRoot, path.dirname(entry.path), "deno.json");
      expect(await exists(denoConfigPath), `${entry.path} is missing its deployable deno.json.`).toBe(true);
      const denoConfig = JSON.parse(await readFile(denoConfigPath, "utf8")) as {
        imports?: Record<string, string>;
      };
      expect(denoConfig.imports?.["@supabase/server"], `${entry.path} must pin @supabase/server.`)
        .toBe("npm:@supabase/server@1.4.1");
    }
  });

  it("authorizes every user-scoped website before privileged work", async () => {
    const entries = (await manifest()).filter((entry) => entry.boundary === "website_rls");
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const source = handlerSource(await readFile(path.join(productRoot, entry.path), "utf8"));
      const claim = source.indexOf("context.userClaims?.id");
      const websiteLookup = source.indexOf('context.supabase.from("websites")');
      const denial = source.indexOf("You do not have access to that website.");
      const privileged = source.indexOf("context.supabaseAdmin");
      const environmentRead = source.indexOf("Deno.env.get(");

      expect(claim, `${entry.path} must derive the user from verified claims.`).toBeGreaterThanOrEqual(0);
      expect(websiteLookup, `${entry.path} must authorize the website through RLS.`).toBeGreaterThan(claim);
      expect(denial, `${entry.path} must fail closed when RLS hides the website.`).toBeGreaterThan(websiteLookup);
      if (environmentRead >= 0) {
        expect(environmentRead, `${entry.path} must authorize the website before exposing configuration state.`)
          .toBeGreaterThan(denial);
      }
      expect(privileged, `${entry.path} must authorize before using the service role.`).toBeGreaterThan(denial);
    }
  });

  it("derives account deletion identity only from verified claims", async () => {
    const entry = (await manifest()).find((item) => item.boundary === "account_claim");
    expect(entry).toBeDefined();
    const source = handlerSource(await readFile(path.join(productRoot, entry!.path), "utf8"));

    const claim = source.indexOf("const userId = context.userClaims?.id");
    const claimDenial = source.indexOf("if (!userId)");
    const privileged = source.indexOf("context.supabaseAdmin");
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(claimDenial).toBeGreaterThan(claim);
    expect(privileged).toBeGreaterThan(claimDenial);
    expect(source).not.toMatch(/body\.(?:userId|user_id)/);
  });

  it("consumes signed OAuth state before storing credentials", async () => {
    const entry = (await manifest()).find((item) => item.boundary === "oauth_state");
    expect(entry).toBeDefined();
    const source = handlerSource(await readFile(path.join(productRoot, entry!.path), "utf8"));

    expect(source).not.toContain("request.json(");
    const bounds = source.indexOf("state.length < 32 || state.length > 128");
    const hash = source.indexOf("const stateHash = await sha256(state)");
    const consume = source.indexOf('rpc("consume_google_oauth_state"');
    const validateSaved = source.indexOf('typeof saved.userId !== "string"');
    const store = source.indexOf('rpc("store_google_oauth_connection"');
    expect(bounds).toBeGreaterThanOrEqual(0);
    expect(hash).toBeGreaterThan(bounds);
    expect(consume).toBeGreaterThan(hash);
    expect(validateSaved).toBeGreaterThan(consume);
    expect(store).toBeGreaterThan(validateSaved);
  });

  it("rejects unauthenticated cron work before privileged queries", async () => {
    const entry = (await manifest()).find((item) => item.boundary === "cron_secret");
    expect(entry).toBeDefined();
    const source = handlerSource(await readFile(path.join(productRoot, entry!.path), "utf8"));

    const configuredSecret = source.indexOf('Deno.env.get("RANK_TRACKER_CRON_SECRET")');
    const suppliedSecret = source.indexOf('request.headers.get("x-rank-tracker-secret")');
    const unauthorized = source.indexOf('json({ error: "Unauthorized." }, 401)');
    const privileged = source.indexOf("context.supabaseAdmin");
    expect(configuredSecret).toBeGreaterThanOrEqual(0);
    expect(suppliedSecret).toBeGreaterThan(configuredSecret);
    expect(unauthorized).toBeGreaterThan(suppliedSecret);
    expect(privileged).toBeGreaterThan(unauthorized);
  });

  it("separates signed unsubscribe access from secret-protected digest work", async () => {
    const entry = (await manifest()).find((item) => item.boundary === "signed_token_or_cron");
    expect(entry).toBeDefined();
    const fullSource = compact(await readFile(path.join(productRoot, entry!.path), "utf8"));
    const source = handlerSource(fullSource);

    expect(fullSource).toContain('crypto.subtle.importKey("raw"');
    expect(fullSource).toContain("mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index)");
    const verifyToken = source.indexOf("await verifiedWebsiteId(unsubscribe, tokenSecret)");
    const unsubscribeWrite = source.indexOf('context.supabaseAdmin.from("notification_preferences").update');
    const cronSecret = source.indexOf('Deno.env.get("RANK_TRACKER_CRON_SECRET")', unsubscribeWrite);
    const suppliedSecret = source.indexOf('request.headers.get("x-rank-tracker-secret")', cronSecret);
    const cronUnauthorized = source.indexOf('json({ error: "Unauthorized." }, 401)', suppliedSecret);
    const backgroundWork = source.indexOf("await reconcileProviderReceipts(context, apiKey)", cronUnauthorized);

    expect(verifyToken).toBeGreaterThanOrEqual(0);
    expect(unsubscribeWrite).toBeGreaterThan(verifyToken);
    expect(cronSecret).toBeGreaterThan(unsubscribeWrite);
    expect(suppliedSecret).toBeGreaterThan(cronSecret);
    expect(cronUnauthorized).toBeGreaterThan(suppliedSecret);
    expect(backgroundWork).toBeGreaterThan(cronUnauthorized);
  });
});
