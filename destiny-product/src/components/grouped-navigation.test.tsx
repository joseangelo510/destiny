import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import { ProductNavigation } from "./product-navigation";
const site = { id: "11111111-1111-4111-8111-111111111111", business_name: "Example", normalized_domain: "example.com" };
const markup = (active: string) => renderToStaticMarkup(<ProductNavigation active={active} websiteId={site.id} websites={[site]} />);
it("organizes all existing tools once with utilities outside the tool groups", () => {
  const html = markup("/domain-overview");
  const groups = [...html.matchAll(/<details[^>]*data-tool-group="([^"]+)"[^>]*>(.*?)<\/details>/g)];
  expect(groups.map(g => g[1])).toEqual(["Competitor research", "Keywords", "Content creation", "Website optimization", "Publishing &amp; distribution", "Analytics &amp; reporting", "Planning"]);
  const utilities = html.match(/<nav aria-label="Account and connections"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
  expect(utilities).toContain("Account"); expect(utilities).toContain("Connections");
  const links = [...(groups.map(g=>g[2]).join("") + utilities).matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  expect(links).toHaveLength(21);
  for (const item of [...FEATURE_NAVIGATION, {href:"/account"}]) {
    const [path, hash] = item.href.split("#");
    expect(links.filter(link=>link === `${path}?site=${site.id}${hash ? `#${hash}` : ""}`)).toHaveLength(1);
  }
});
it("opens only the active tool group while preserving its selected link", () => {
  for (const [path, group] of [["/domain-overview","Competitor research"],["/keywords","Keywords"],["/content","Content creation"],["/audits","Website optimization"],["/reviews","Publishing &amp; distribution"],["/analytics","Analytics &amp; reporting"],["/roadmap","Planning"]]) {
    const html = markup(path);
    const openGroups = [...html.matchAll(/<details[^>]*data-tool-group="([^"]+)"[^>]*open=""/g)].map(m=>m[1]);
    expect(openGroups).toEqual([group]);
    expect(html).toContain('aria-current="page"');
  }
  expect(markup("/app/home").match(/data-tool-group="[^"]+"[^>]*open=""/g)).toBeNull();
});
