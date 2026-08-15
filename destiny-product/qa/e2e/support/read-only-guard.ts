import { expect, type Page } from "@playwright/test";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_REFRESH = /\/auth\/v1\/token/;

export async function installProductionReadOnlyGuard(page: Page) {
  const blocked: Array<{ method: string; url: string }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();
    const isDestinyApi = new URL(url).hostname === "destiny-seo.replit.app" && new URL(url).pathname.startsWith("/api/");
    const isSupabaseWrite = /\.supabase\.co\/rest\/v1\//.test(url) && !SAFE_METHODS.has(method);
    if (!SAFE_METHODS.has(method) && (isDestinyApi || isSupabaseWrite) && !AUTH_REFRESH.test(url)) {
      blocked.push({ method, url });
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return {
    assertNoMutationAttempt() {
      expect(blocked, `Production read-only run attempted mutation:\n${JSON.stringify(blocked, null, 2)}`).toEqual([]);
    },
  };
}
