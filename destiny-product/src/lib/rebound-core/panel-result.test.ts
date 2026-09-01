import { describe, expect, it } from "vitest";
import { empty, failed, loading, notConnected, ready } from "./panel-result";

describe("typed adapter results", () => {
  it("represents every allowed adapter state without substituting zero data", () => {
    expect(loading<number>().state).toBe("loading");
    expect(ready(12)).toMatchObject({ state: "ready", data: 12, message: null });
    expect(empty<number>("No rows")).toMatchObject({ state: "empty", data: null });
    expect(notConnected<number>("Connect provider")).toMatchObject({ state: "not_connected", data: null });
    expect(failed<number>()).toMatchObject({ state: "error", data: null });
  });
});
