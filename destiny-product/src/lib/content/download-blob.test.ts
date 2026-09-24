import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/lib/content/download-blob";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts an attached-anchor download before releasing the object URL", () => {
    vi.useFakeTimers();
    const events: string[] = [];
    const anchor = {
      click: () => events.push("click"),
      download: "",
      href: "",
      remove: () => events.push("remove"),
      style: { display: "" },
    };

    vi.stubGlobal("URL", {
      createObjectURL: () => {
        events.push("create");
        return "blob:rebound-word";
      },
      revokeObjectURL: () => events.push("revoke"),
    });
    vi.stubGlobal("document", {
      body: { appendChild: () => events.push("append") },
      createElement: () => anchor,
    });

    downloadBlob(new Blob(["document"]), "article.docx");

    expect(anchor.href).toBe("blob:rebound-word");
    expect(anchor.download).toBe("article.docx");
    expect(anchor.style.display).toBe("none");
    expect(events).toEqual(["create", "append", "click", "remove"]);

    vi.runAllTimers();
    expect(events).toEqual(["create", "append", "click", "remove", "revoke"]);
  });
});
