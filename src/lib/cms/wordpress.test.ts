import { describe, expect, it } from "vitest";
import { prepareWordPressConnection } from "./wordpress";

describe("WordPress CMS connection", () => {
  it("normalizes the HTTPS site and builds a Basic Auth verification request", () => {
    expect(prepareWordPressConnection({
      siteUrl: "example.com/blog/",
      username: "editor@example.com",
      applicationPassword: "abcd efgh ijkl mnop",
    })).toEqual({
      siteUrl: "https://example.com/blog",
      endpoint: "https://example.com/blog/wp-json/wp/v2/users/me?context=edit",
      authorization: `Basic ${btoa("editor@example.com:abcdefghijklmnop")}`,
    });
  });

  it.each([
    { siteUrl: "javascript:alert(1)", username: "editor", applicationPassword: "password" },
    { siteUrl: "http://example.com", username: "editor", applicationPassword: "password" },
    { siteUrl: "example.com", username: "", applicationPassword: "password" },
    { siteUrl: "example.com", username: "editor", applicationPassword: "" },
  ])("rejects unsafe or incomplete credentials", (input) => {
    expect(() => prepareWordPressConnection(input)).toThrow();
  });
});
