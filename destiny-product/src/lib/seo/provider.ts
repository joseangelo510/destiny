import { DataForSeoProvider } from "./dataforseo-provider";
import { DemoSeoProvider } from "./demo-provider";
import type { SeoProvider } from "./types";

export function getSeoProvider(): SeoProvider {
  const selected = process.env.DESTINY_SEO_PROVIDER?.trim().toLowerCase() || "demo";
  if (selected === "demo") return new DemoSeoProvider();
  if (selected !== "dataforseo") {
    throw new Error(`Unsupported SEO provider: ${selected}`);
  }

  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) {
    throw new Error("DataForSEO is selected, but its API credentials are missing.");
  }
  return new DataForSeoProvider(login, password);
}

