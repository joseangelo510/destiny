import { expect, test } from "@playwright/test";

test("public internal links resolve", async ({ page, request, baseURL }) => {
  await page.goto("/");
  const links = await page.locator('a[href^="/"]').evaluateAll((elements) => [...new Set(elements.map((element) => element.getAttribute("href")).filter(Boolean))] as string[]);
  for (const href of links) {
    const url = new URL(href, baseURL).toString();
    const response = await request.get(url, { maxRedirects: 5 });
    expect(response.status(), `${url} returned ${response.status()}`).toBeLessThan(500);
  }
});
