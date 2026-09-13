const encoder = new TextEncoder();
async function key(secret: string) {
  if (encoder.encode(secret).length < 32) throw new Error("Billing worker authentication is not configured");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signWorkerRequest(body: string, audience: string, secret: string, now = Date.now()): Promise<Record<string, string>> {
  const timestamp = String(Math.floor(now / 1000));
  const bytes = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(`${audience}\n${timestamp}\n${body}`));
  return { "x-rebound-worker-time": timestamp, "x-rebound-worker-signature": Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("") };
}
export async function verifyWorkerRequest(body: string, audience: string, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const timestamp = headers.get("x-rebound-worker-time") ?? "";
  const signature = headers.get("x-rebound-worker-signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const age = Math.floor(now / 1000) - Number(timestamp);
  if (age < -30 || age > 300) return false;
  try {
    const bytes = Uint8Array.from(signature.match(/../g)!, byte => parseInt(byte, 16));
    return await crypto.subtle.verify("HMAC", await key(secret), bytes, encoder.encode(`${audience}\n${timestamp}\n${body}`));
  } catch { return false; }
}
