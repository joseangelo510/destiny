import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("tolerates browser extensions that annotate the body before hydration", () => {
    const layout = RootLayout({ children: <main>Rebound SEO</main> });
    const body = layout.props.children as ReactElement<{ suppressHydrationWarning?: boolean }>;

    expect(body.props.suppressHydrationWarning).toBe(true);
  });
});
