/**
 * repurpose-url.test.ts
 *
 * Deterministic Vitest unit tests for the secure URL-ingestion library.
 * All DNS and fetch calls are injected — no real network I/O.
 *
 * New tests (security review) are grouped at the top of each section.
 */

import { describe, expect, it, vi } from "vitest";
import {
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  RepurposeUrlError,
  ingestSourceUrl,
  type DnsResolver,
  type FetchFn,
} from "./repurpose-url";

// ─── Mock builders ────────────────────────────────────────────────────────────

/** A DNS resolver that always returns the given address(es). */
function mockDns(addresses: string[]): DnsResolver {
  return async () => addresses;
}

/** A DNS resolver that always throws (simulates NXDOMAIN). */
function failingDns(): DnsResolver {
  return async () => {
    throw new Error("ENOTFOUND");
  };
}

type MockResponse = {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  bodyBytes?: Uint8Array;
  /** Provide a ReadableStream body for streaming tests. */
  bodyStream?: ReadableStream<Uint8Array>;
};

/**
 * Build a mock fetch that returns the given sequence of responses (queue)
 * or a single response for every call.
 * Supports both arrayBuffer() and ReadableStream body.
 */
function mockFetch(responses: MockResponse | MockResponse[]): FetchFn {
  const queue = Array.isArray(responses) ? [...responses] : null;
  const single = Array.isArray(responses) ? null : responses;

  return async (_url: string, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) {
      throw Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      });
    }

    const r = queue ? (queue.shift() ?? { ok: false, status: 500 }) : single!;
    const status = r.status ?? (r.ok === false ? 500 : 200);
    const ok = r.ok !== undefined ? r.ok : status >= 200 && status < 300;
    const hdrs: Record<string, string> = r.headers ?? {
      "content-type": "text/html",
    };
    const bodyStr = r.body ?? "";
    const bodyBytes = r.bodyBytes ?? new TextEncoder().encode(bodyStr);

    // Build a ReadableStream if caller supplied one, otherwise build from bytes
    const bodyStream: ReadableStream<Uint8Array> | null = r.bodyStream
      ? r.bodyStream
      : new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(bodyBytes);
            ctrl.close();
          },
        });

    return {
      ok,
      status,
      headers: {
        get(name: string) {
          const lower = name.toLowerCase();
          for (const [k, v] of Object.entries(hdrs)) {
            if (k.toLowerCase() === lower) return v;
          }
          return null;
        },
      },
      body: bodyStream,
      async text() {
        return bodyStr;
      },
      async arrayBuffer() {
        return bodyBytes.buffer as ArrayBuffer;
      },
    };
  };
}

/** A fetch that simulates a timeout by throwing an abort-like error. */
const abortingFetch: FetchFn = async () => {
  throw Object.assign(new Error("abort"), { name: "AbortError" });
};

const publicDns = mockDns(["93.184.216.34"]); // example.com public IP

// ─── Helper: simple valid HTML page ─────────────────────────────────────────

function htmlPage(body: string, title = "Test Page"): string {
  return `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`;
}

/** Make a ReadableStream that emits chunks then closes. */
function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      for (const chunk of chunks) ctrl.enqueue(chunk);
      ctrl.close();
    },
  });
}

// ─── NEW: Default DNS all:true (both IPv4 + IPv6) ────────────────────────────

describe("ingestSourceUrl – DNS resolver rejects mixed IPv4/IPv6 results", () => {
  it("blocks a host returning a public IPv4 AND a private IPv6", async () => {
    // Resolver returns both a public IPv4 and a private IPv6 address
    const mixedDns = mockDns(["93.184.216.34", "::1"]);
    await expect(
      ingestSourceUrl("http://dual.example.com/", {
        dns: mixedDns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("blocks a host returning a public IPv4 AND a private IPv4 10.x", async () => {
    const mixedDns = mockDns(["93.184.216.34", "10.0.0.1"]);
    await expect(
      ingestSourceUrl("http://dual.example.com/", {
        dns: mixedDns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("blocks a host returning a private fc00:: IPv6 address", async () => {
    const ipv6Dns = mockDns(["fc00::dead:beef"]);
    await expect(
      ingestSourceUrl("http://ipv6only.example.com/", {
        dns: ipv6Dns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("allows a host returning only public addresses (IPv4 + IPv6)", async () => {
    // 2001:db8:: is documentation/reserved, but let's use a genuinely public one.
    // For test purposes we use a made-up non-private IPv6.
    const allPublicDns = mockDns(["93.184.216.34", "2001:4860:4860::8888"]);
    const body = htmlPage(
      "<p>This is real content about repurposing for a dual-stack host.</p>",
      "Dual Stack",
    );
    const result = await ingestSourceUrl("http://dual.example.com/", {
      dns: allPublicDns,
      fetch: mockFetch({ ok: true, status: 200, headers: { "content-type": "text/html" }, body }),
    });
    expect(result.title).toBe("Dual Stack");
  });
});

describe("ingestSourceUrl – DNS rebinding protection", () => {
  it("passes the already-validated public addresses to the fetch hop", async () => {
    let pinnedAddresses: string[] | undefined;
    const fetch: FetchFn = async (_url, init) => {
      pinnedAddresses = init?.resolvedAddresses;
      return mockFetch({
        headers: { "content-type": "text/html" },
        body: htmlPage("This page has enough readable content for secure URL ingestion."),
      })(_url, init);
    };

    await ingestSourceUrl("https://example.com/guide", {
      dns: mockDns(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]),
      fetch,
    });

    expect(pinnedAddresses).toEqual([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);
  });
});

// ─── NEW: Content-Length preflight ───────────────────────────────────────────

describe("ingestSourceUrl – Content-Length preflight", () => {
  it("rejects when Content-Length header > 2 MB before reading body", async () => {
    // The mock body is tiny; rejection must happen from the header alone.
    await expect(
      ingestSourceUrl("http://example.com/large", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: {
            "content-type": "text/html",
            "content-length": String(MAX_RESPONSE_BYTES + 1),
          },
          body: "<html><body>tiny</body></html>",
        }),
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("allows when Content-Length header == 2 MB exactly", async () => {
    const body = htmlPage(
      "<p>Content with enough readable text to pass the minimum length check.</p>",
    );
    const result = await ingestSourceUrl("http://example.com/exact", {
      dns: publicDns,
      fetch: mockFetch({
        ok: true,
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": String(MAX_RESPONSE_BYTES),
        },
        body,
      }),
    });
    expect(result.text).toContain("readable text");
  });
});

// ─── NEW: Streaming body cap ──────────────────────────────────────────────────

describe("ingestSourceUrl – streaming body cap", () => {
  it("rejects a streaming body that exceeds 2 MB in-flight", async () => {
    // Send one chunk just over the limit via a ReadableStream
    const bigChunk = new Uint8Array(MAX_RESPONSE_BYTES + 1).fill(0x41);
    const streamFetch: FetchFn = mockFetch({
      ok: true,
      status: 200,
      headers: { "content-type": "text/html" },
      bodyStream: streamOf(bigChunk),
    });
    await expect(
      ingestSourceUrl("http://example.com/stream-large", {
        dns: publicDns,
        fetch: streamFetch,
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("accepts a streaming body just under 2 MB and returns content", async () => {
    const enc = new TextEncoder();
    // Build a chunk that's just under the limit and contains readable HTML
    const htmlStart = enc.encode(
      "<!DOCTYPE html><html><head><title>Stream OK</title></head><body><p>",
    );
    const filler = new Uint8Array(
      MAX_RESPONSE_BYTES - htmlStart.length - 200,
    ).fill(0x41); // 'A'
    const htmlEnd = enc.encode(
      " filler text about content repurposing strategies.</p></body></html>",
    );

    const streamFetch: FetchFn = mockFetch({
      ok: true,
      status: 200,
      headers: { "content-type": "text/html" },
      bodyStream: streamOf(htmlStart, filler, htmlEnd),
    });

    const result = await ingestSourceUrl("http://example.com/stream-ok", {
      dns: publicDns,
      fetch: streamFetch,
    });
    expect(result.title).toBe("Stream OK");
  });

  it("accumulates multiple small chunks correctly", async () => {
    const enc = new TextEncoder();
    const chunks = [
      enc.encode("<!DOCTYPE html><html><head><title>Chunked</title></head><body><p>"),
      enc.encode("This is chunked content about repurposing strategies and marketing."),
      enc.encode("</p></body></html>"),
    ];
    const streamFetch: FetchFn = mockFetch({
      ok: true,
      status: 200,
      headers: { "content-type": "text/html" },
      bodyStream: streamOf(...chunks),
    });
    const result = await ingestSourceUrl("http://example.com/chunked", {
      dns: publicDns,
      fetch: streamFetch,
    });
    expect(result.title).toBe("Chunked");
    expect(result.text).toContain("repurposing strategies");
  });
});

// ─── NEW: YouTube uses manual redirects ───────────────────────────────────────

describe("ingestSourceUrl – YouTube manual redirect safety", () => {
  const captionBaseUrl = "https://www.youtube.com/api/timedtext?lang=en&v=TEST123";

  function ytWatchPage(hasCaptions: boolean): string {
    return `<html><head><title>Test Video - YouTube</title></head><body><script>
    var ytCfg = {
      ${hasCaptions ? `"captionTracks":[{"baseUrl":"${captionBaseUrl}","languageCode":"en","kind":"standard","name":{"simpleText":"English"}}]` : ""}
    };
    </script></body></html>`;
  }

  it("raises TOO_MANY_REDIRECTS if the YouTube watch page redirects too many times", async () => {
    const tooManyRedirects = Array.from({ length: MAX_REDIRECTS + 2 }, (_, i) => ({
      ok: false,
      status: 301,
      headers: { location: `https://www.youtube.com/watch?v=TEST123&r=${i}` },
    }));
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=TEST123", {
        dns: publicDns,
        fetch: mockFetch(tooManyRedirects),
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("raises PRIVATE_HOST if the YouTube watch page redirects to a private IP", async () => {
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=TEST123", {
        dns: publicDns,
        fetch: mockFetch([
          {
            ok: false,
            status: 301,
            headers: { location: "http://169.254.169.254/meta" },
          },
        ]),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("raises TIMEOUT when the YouTube watch page times out", async () => {
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=TEST123", {
        dns: publicDns,
        fetch: abortingFetch,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("raises RESPONSE_TOO_LARGE when YouTube watch page body exceeds 2 MB via stream", async () => {
    const bigChunk = new Uint8Array(MAX_RESPONSE_BYTES + 1).fill(0x41);
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=TEST123", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "text/html" },
          bodyStream: streamOf(bigChunk),
        }),
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("raises RESPONSE_TOO_LARGE when caption body exceeds 2 MB", async () => {
    const bigChunk = new Uint8Array(MAX_RESPONSE_BYTES + 1).fill(0x41);
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=TEST123", {
        dns: publicDns,
        fetch: mockFetch([
          // Watch page (valid, with captions)
          {
            ok: true,
            status: 200,
            headers: { "content-type": "text/html" },
            body: ytWatchPage(true),
          },
          // Caption response — over size limit via stream
          {
            ok: true,
            status: 200,
            headers: { "content-type": "text/xml" },
            bodyStream: streamOf(bigChunk),
          },
        ]),
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});

// ─── Existing: URL validation ─────────────────────────────────────────────────

describe("ingestSourceUrl – URL validation", () => {
  it("rejects a non-URL string with INVALID_URL", async () => {
    await expect(
      ingestSourceUrl("not a url", { dns: publicDns, fetch: mockFetch({}) }),
    ).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("rejects a javascript: URL with UNSUPPORTED_SCHEME", async () => {
    await expect(
      ingestSourceUrl("javascript:alert(1)", {
        dns: publicDns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEME" });
  });

  it("rejects a ftp: URL with UNSUPPORTED_SCHEME", async () => {
    await expect(
      ingestSourceUrl("ftp://files.example.com/doc.txt", {
        dns: publicDns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEME" });
  });

  it("rejects a data: URL with UNSUPPORTED_SCHEME", async () => {
    await expect(
      ingestSourceUrl("data:text/html,hello", {
        dns: publicDns,
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_SCHEME" });
  });
});

// ─── Existing: SSRF block-list ────────────────────────────────────────────────

describe("ingestSourceUrl – SSRF block-list (hostname patterns)", () => {
  const privateDns = mockDns(["93.184.216.34"]);

  it.each([
    "http://localhost/",
    "http://localhost:8080/api",
    "http://localhost.evil.com.localhost/",
    "http://service.internal/secrets",
    "http://api.local/data",
    "http://thing.example/",
    "http://noop.invalid/",
    "http://test.test/",
  ])("blocks hostname-pattern %s with PRIVATE_HOST", async (url) => {
    await expect(
      ingestSourceUrl(url, { dns: privateDns, fetch: mockFetch({}) }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });
});

describe("ingestSourceUrl – SSRF block-list (raw IPv4)", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://172.16.5.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://0.0.0.0/",
    "http://100.64.0.1/",
  ])("blocks raw IPv4 %s with PRIVATE_HOST", async (url) => {
    await expect(
      ingestSourceUrl(url, { dns: publicDns, fetch: mockFetch({}) }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });
});

describe("ingestSourceUrl – SSRF block-list (raw IPv6)", () => {
  it.each([
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:192.168.1.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:c0a8:101]/",
    "http://[::7f00:1]/",
    "http://[2002:7f00:1::]/",
  ])("blocks raw IPv6 %s with PRIVATE_HOST", async (url) => {
    await expect(
      ingestSourceUrl(url, { dns: publicDns, fetch: mockFetch({}) }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });
});

describe("ingestSourceUrl – SSRF block-list (DNS resolves to private)", () => {
  it("blocks a public hostname that resolves to 127.0.0.1", async () => {
    await expect(
      ingestSourceUrl("http://evil.example.com/", {
        dns: mockDns(["127.0.0.1"]),
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("blocks a public hostname that resolves to 10.0.0.5", async () => {
    await expect(
      ingestSourceUrl("http://internal.example.com/", {
        dns: mockDns(["10.0.0.5"]),
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it.each([
    "::ffff:7f00:1",
    "::ffff:c0a8:101",
    "::7f00:1",
    "2002:7f00:1::",
  ])("blocks hexadecimal mapped or tunneled DNS answer %s before fetch", async (address) => {
    const fetch = vi.fn(mockFetch({}));
    await expect(
      ingestSourceUrl("https://public.example.org/article", {
        dns: mockDns([address]),
        fetch,
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("raises INVALID_URL when DNS resolution fails", async () => {
    await expect(
      ingestSourceUrl("http://nonexistent.example.com/", {
        dns: failingDns(),
        fetch: mockFetch({}),
      }),
    ).rejects.toMatchObject({ code: "INVALID_URL" });
  });
});

// ─── Existing: Redirect handling ─────────────────────────────────────────────

describe("ingestSourceUrl – redirect handling", () => {
  it("follows up to MAX_REDIRECTS and returns content", async () => {
    const redirectResponses: MockResponse[] = [
      {
        ok: false,
        status: 301,
        headers: {
          location: "http://example.com/step2",
          "content-type": "text/html",
        },
      },
      {
        ok: false,
        status: 302,
        headers: {
          location: "http://example.com/step3",
          "content-type": "text/html",
        },
      },
      {
        ok: false,
        status: 302,
        headers: {
          location: "http://example.com/final",
          "content-type": "text/html",
        },
      },
      {
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body: htmlPage(
          "<p>Final destination content that is long enough to count.</p>",
          "Final Page",
        ),
      },
    ];
    const result = await ingestSourceUrl("http://example.com/start", {
      dns: publicDns,
      fetch: mockFetch(redirectResponses),
    });
    expect(result.title).toBe("Final Page");
    expect(result.text).toContain("Final destination");
  });

  it(`raises TOO_MANY_REDIRECTS after more than ${MAX_REDIRECTS} hops`, async () => {
    const tooMany: MockResponse[] = Array.from(
      { length: MAX_REDIRECTS + 2 },
      (_, i) => ({
        ok: false,
        status: 301,
        headers: {
          location: `http://example.com/step${i + 1}`,
          "content-type": "text/html",
        },
      }),
    );
    await expect(
      ingestSourceUrl("http://example.com/", {
        dns: publicDns,
        fetch: mockFetch(tooMany),
      }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("re-validates each redirect hop for SSRF", async () => {
    const responses: MockResponse[] = [
      {
        ok: false,
        status: 301,
        headers: {
          location: "http://169.254.169.254/latest/meta-data/",
          "content-type": "text/html",
        },
      },
    ];
    await expect(
      ingestSourceUrl("http://example.com/start", {
        dns: publicDns,
        fetch: mockFetch(responses),
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_HOST" });
  });

  it("raises HTTP_ERROR for a redirect with no Location header", async () => {
    const responses: MockResponse[] = [
      { ok: false, status: 301, headers: { "content-type": "text/html" } },
    ];
    await expect(
      ingestSourceUrl("http://example.com/", {
        dns: publicDns,
        fetch: mockFetch(responses),
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });
});

// ─── Existing: Size cap ───────────────────────────────────────────────────────

describe("ingestSourceUrl – size cap (arrayBuffer fallback)", () => {
  it(`raises RESPONSE_TOO_LARGE for a response > ${MAX_RESPONSE_BYTES / 1024 / 1024} MB via arrayBuffer`, async () => {
    const huge = new Uint8Array(MAX_RESPONSE_BYTES + 1).fill(0x41);
    // Provide bodyBytes only (no bodyStream) to exercise the arrayBuffer fallback path
    const noStreamFetch: FetchFn = async () => {
      const hdrs = new Map([["content-type", "text/html"]]);
      return {
        ok: true,
        status: 200,
        headers: { get: (n: string) => hdrs.get(n.toLowerCase()) ?? null },
        body: null, // No stream → falls back to arrayBuffer()
        async text() { return ""; },
        async arrayBuffer() { return huge.buffer as ArrayBuffer; },
      };
    };
    await expect(
      ingestSourceUrl("http://example.com/big", {
        dns: publicDns,
        fetch: noStreamFetch,
      }),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});

// ─── Existing: Timeout ────────────────────────────────────────────────────────

describe("ingestSourceUrl – timeout", () => {
  it("raises TIMEOUT when the fetch is aborted", async () => {
    await expect(
      ingestSourceUrl("http://example.com/slow", {
        dns: publicDns,
        fetch: abortingFetch,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

// ─── Existing: HTTP errors ────────────────────────────────────────────────────

describe("ingestSourceUrl – HTTP errors", () => {
  it("raises PAYWALL for 401", async () => {
    await expect(
      ingestSourceUrl("http://example.com/locked", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 401,
          headers: { "content-type": "text/html" },
        }),
      }),
    ).rejects.toMatchObject({ code: "PAYWALL" });
  });

  it("raises PAYWALL for 402", async () => {
    await expect(
      ingestSourceUrl("http://example.com/premium", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 402,
          headers: { "content-type": "text/html" },
        }),
      }),
    ).rejects.toMatchObject({ code: "PAYWALL" });
  });

  it("raises PAYWALL for 403", async () => {
    await expect(
      ingestSourceUrl("http://example.com/forbidden", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 403,
          headers: { "content-type": "text/html" },
        }),
      }),
    ).rejects.toMatchObject({ code: "PAYWALL" });
  });

  it("raises HTTP_ERROR for 404", async () => {
    await expect(
      ingestSourceUrl("http://example.com/missing", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 404,
          headers: { "content-type": "text/html" },
        }),
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("raises HTTP_ERROR for 500", async () => {
    await expect(
      ingestSourceUrl("http://example.com/error", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 500,
          headers: { "content-type": "text/html" },
        }),
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });
});

// ─── Existing: Content-type filtering ────────────────────────────────────────

describe("ingestSourceUrl – content-type filtering", () => {
  it("raises UNSUPPORTED_CONTENT_TYPE for application/pdf", async () => {
    await expect(
      ingestSourceUrl("http://example.com/doc.pdf", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "application/pdf" },
          body: "%PDF",
        }),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });
  });

  it("raises UNSUPPORTED_CONTENT_TYPE for image/png", async () => {
    await expect(
      ingestSourceUrl("http://example.com/img.png", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "image/png" },
          body: "",
        }),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CONTENT_TYPE" });
  });
});

// ─── Existing: Page content failures ─────────────────────────────────────────

describe("ingestSourceUrl – page content failures", () => {
  it("raises PAYWALL when page contains paywall signal", async () => {
    const body = htmlPage(
      "<p>Subscribe to continue reading this article. Subscribe to read more.</p>",
    );
    await expect(
      ingestSourceUrl("http://example.com/article", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "text/html" },
          body,
        }),
      }),
    ).rejects.toMatchObject({ code: "PAYWALL" });
  });

  it("raises JS_ONLY when page is a JS-rendered SPA with no content", async () => {
    const body = `<!DOCTYPE html><html><head><title>App</title></head><body><div id="__next"></div><noscript>Enable JS</noscript></body></html>`;
    await expect(
      ingestSourceUrl("http://example.com/spa", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "text/html" },
          body,
        }),
      }),
    ).rejects.toMatchObject({ code: "JS_ONLY" });
  });

  it("raises NO_CONTENT for an effectively empty HTML page", async () => {
    const body = `<!DOCTYPE html><html><head><title>Empty</title></head><body>   </body></html>`;
    await expect(
      ingestSourceUrl("http://example.com/empty", {
        dns: publicDns,
        fetch: mockFetch({
          ok: true,
          status: 200,
          headers: { "content-type": "text/html" },
          body,
        }),
      }),
    ).rejects.toMatchObject({ code: "NO_CONTENT" });
  });
});

// ─── Existing: Successful HTML ingestion ─────────────────────────────────────

describe("ingestSourceUrl – successful HTML ingestion", () => {
  it("extracts title and text from a clean HTML page", async () => {
    const body = htmlPage(
      "<h1>Welcome</h1><p>This is a lengthy article about content repurposing techniques and best practices for marketing teams worldwide.</p>",
      "Welcome Page",
    );
    const result = await ingestSourceUrl("https://example.com/article", {
      dns: publicDns,
      fetch: mockFetch({
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body,
      }),
    });
    expect(result.title).toBe("Welcome Page");
    expect(result.text).toContain("content repurposing");
    expect(result.source).toBe("html");
    expect(result.url).toContain("example.com");
  });

  it("strips nav/footer/script noise from extracted text", async () => {
    const body = `<html><head><title>Clean</title></head><body>
      <nav>Nav link 1 Nav link 2</nav>
      <header>Logo</header>
      <main><p>This is the real article content that should be extracted for repurposing.</p></main>
      <footer>Copyright 2024</footer>
      <script>window.onload = function() { alert('hi'); }</script>
      </body></html>`;
    const result = await ingestSourceUrl("https://example.com/clean", {
      dns: publicDns,
      fetch: mockFetch({
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body,
      }),
    });
    expect(result.text).toContain("real article content");
    expect(result.text).not.toContain("window.onload");
  });

  it("accepts application/xhtml+xml content type", async () => {
    const body = `<?xml version="1.0"?><html><head><title>XHTML</title></head><body><p>Content that is long enough to be real substantial readable text.</p></body></html>`;
    const result = await ingestSourceUrl("https://example.com/xhtml", {
      dns: publicDns,
      fetch: mockFetch({
        ok: true,
        status: 200,
        headers: { "content-type": "application/xhtml+xml" },
        body,
      }),
    });
    expect(result.title).toBe("XHTML");
  });

  it("extracts plain text pages with source=text", async () => {
    const body = "This is a plain text article about repurposing strategies.";
    const result = await ingestSourceUrl("https://example.com/plain.txt", {
      dns: publicDns,
      fetch: mockFetch({
        ok: true,
        status: 200,
        headers: { "content-type": "text/plain" },
        body,
      }),
    });
    expect(result.source).toBe("text");
    expect(result.text).toContain("plain text article");
  });
});

// ─── Existing: YouTube caption extraction ────────────────────────────────────

describe("ingestSourceUrl – YouTube detection", () => {
  const ytCaptionXml = `<?xml version="1.0" encoding="utf-8" ?><transcript>
    <text start="0.0" dur="4.0">Hello and welcome to this video.</text>
    <text start="4.0" dur="3.5">Today we discuss content repurposing strategies.</text>
    <text start="7.5" dur="2.0">Let&apos;s get started.</text>
  </transcript>`;

  const captionBaseUrl =
    "https://www.youtube.com/api/timedtext?lang=en&v=dQw4w9WgXcQ";

  const ytWatchPageHtml = (hasCaptions: boolean) =>
    `<html><head><title>Test Video - YouTube</title></head><body>
    <script>
    var ytInitialPlayerResponse = {
      "captions": {
        "playerCaptionsTracklistRenderer": {
          ${
            hasCaptions
              ? `"captionTracks": [{"baseUrl":"${captionBaseUrl}","languageCode":"en","kind":"standard","name":{"simpleText":"English"}}]`
              : ""
          }
        }
      }
    };
    </script></body></html>`;

  function makeYtFetch(hasCaptions: boolean): FetchFn {
    return mockFetch([
      {
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body: ytWatchPageHtml(hasCaptions),
      },
      {
        ok: true,
        status: 200,
        headers: { "content-type": "text/xml" },
        body: ytCaptionXml,
      },
    ]);
  }

  it("detects youtube.com URLs and returns source=youtube", async () => {
    const result = await ingestSourceUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { dns: publicDns, fetch: makeYtFetch(true) },
    );
    expect(result.source).toBe("youtube");
    expect(result.title).toBe("Test Video");
    expect(result.text).toContain("content repurposing");
  });

  it("detects youtu.be short URLs", async () => {
    const result = await ingestSourceUrl("https://youtu.be/dQw4w9WgXcQ", {
      dns: publicDns,
      fetch: makeYtFetch(true),
    });
    expect(result.source).toBe("youtube");
  });

  it("detects m.youtube.com URLs", async () => {
    const result = await ingestSourceUrl(
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      { dns: publicDns, fetch: makeYtFetch(true) },
    );
    expect(result.source).toBe("youtube");
  });

  it("raises NO_CAPTIONS with recovery guidance when no captionTracks present", async () => {
    const err = await ingestSourceUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { dns: publicDns, fetch: makeYtFetch(false) },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(RepurposeUrlError);
    expect(err.code).toBe("NO_CAPTIONS");
    expect(err.message).toContain("captions");
    expect(err.message).toContain("transcript");
  });

  it("decodes HTML entities in caption text", async () => {
    const xmlWithEntities = `<transcript>
      <text start="0.0" dur="1.0">Let&apos;s use &amp;amp; in text &lt;example&gt;.</text>
    </transcript>`;
    const fetchWithEntities = mockFetch([
      {
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body: ytWatchPageHtml(true),
      },
      {
        ok: true,
        status: 200,
        headers: { "content-type": "text/xml" },
        body: xmlWithEntities,
      },
    ]);
    const result = await ingestSourceUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { dns: publicDns, fetch: fetchWithEntities },
    );
    expect(result.text).toContain("Let's");
    expect(result.text).toContain("&amp;");
  });

  it("raises HTTP_ERROR when the YouTube watch page is unavailable", async () => {
    await expect(
      ingestSourceUrl("https://www.youtube.com/watch?v=PRIVATE123", {
        dns: publicDns,
        fetch: mockFetch({
          ok: false,
          status: 403,
          headers: { "content-type": "text/html" },
          body: "",
        }),
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });
});

// ─── RepurposeUrlError ────────────────────────────────────────────────────────

describe("RepurposeUrlError", () => {
  it("has expected name and code properties", () => {
    const err = new RepurposeUrlError("test message", "PRIVATE_HOST");
    expect(err.name).toBe("RepurposeUrlError");
    expect(err.code).toBe("PRIVATE_HOST");
    expect(err.message).toBe("test message");
    expect(err instanceof Error).toBe(true);
  });
});
