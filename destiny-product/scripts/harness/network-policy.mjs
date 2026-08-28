const MODES = new Set(["mocked", "local-isolated", "staging-readonly", "authorized-live"]);
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function validateNetworkMode(mode) {
  if (!mode) return ["QA_NETWORK_MODE must be declared."];
  if (!MODES.has(mode)) return [`Unknown QA_NETWORK_MODE: ${mode}.`];
  return [];
}

export function assertNetworkRequestAllowed(rawUrl, mode, method = "GET") {
  const errors = validateNetworkMode(mode);
  if (errors.length) throw new Error(errors[0]);
  const url = new URL(rawUrl);
  const verb = method.toUpperCase();
  if (mode === "mocked") throw new Error(`mocked tests may not access network origin ${url.origin}`);
  if (mode === "local-isolated" && !LOOPBACK.has(url.hostname)) throw new Error(`local-isolated tests may access loopback only, not ${url.origin}`);
  if (mode === "staging-readonly" && !READ_METHODS.has(verb)) throw new Error("staging-readonly permits GET, HEAD, and OPTIONS only");
  if (mode === "authorized-live" && process.env.QA_LIVE_AUTHORIZED !== "1") throw new Error("authorized-live requires QA_LIVE_AUTHORIZED=1.");
}
