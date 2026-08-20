import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REPURPOSE_ENCRYPTION_VERSION,
  decryptRepurposeSourceText,
  encryptRepurposeSourceText,
} from "./repurpose-crypto";

const SECRET = "a-test-session-secret-that-never-leaves-the-server";
const SOURCE = "Private source text with a customer example and useful evidence.";

describe("repurpose source encryption", () => {
  it("round-trips plaintext through an authenticated ciphertext envelope", () => {
    const ciphertext = encryptRepurposeSourceText(SOURCE, SECRET);

    expect(ciphertext).toMatch(/^aes-256-gcm-v1\./);
    expect(ciphertext).not.toContain(SOURCE);
    expect(
      decryptRepurposeSourceText(ciphertext, SECRET, REPURPOSE_ENCRYPTION_VERSION),
    ).toBe(SOURCE);
  });

  it("uses a fresh IV so equal sources do not have equal ciphertext", () => {
    expect(encryptRepurposeSourceText(SOURCE, SECRET))
      .not.toBe(encryptRepurposeSourceText(SOURCE, SECRET));
  });

  it("rejects a wrong secret, tampering, and unknown versions", () => {
    const ciphertext = encryptRepurposeSourceText(SOURCE, SECRET);
    const tamperedParts = ciphertext.split(".");
    const tamperedPayload = Buffer.from(tamperedParts[3], "base64url");
    tamperedPayload[0] ^= 1;
    tamperedParts[3] = tamperedPayload.toString("base64url");
    const tamperedCiphertext = tamperedParts.join(".");

    expect(() => decryptRepurposeSourceText(
      ciphertext,
      "different-secret",
      REPURPOSE_ENCRYPTION_VERSION,
    )).toThrow(/could not be decrypted/i);
    expect(() => decryptRepurposeSourceText(
      tamperedCiphertext,
      SECRET,
      REPURPOSE_ENCRYPTION_VERSION,
    )).toThrow(/could not be decrypted/i);
    expect(() => decryptRepurposeSourceText(
      ciphertext,
      SECRET,
      "future-version",
    )).toThrow(/could not be decrypted/i);
  });

  it("keeps plaintext out of the browser-selectable table schema", () => {
    const migration = readFileSync(
      new URL(
        "../../../supabase/migrations/20260820170000_content_repurpose.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).not.toMatch(/\bextracted_text\s+text\b/i);
    expect(migration).toMatch(/\bextracted_text_ciphertext\s+text\b/i);
    expect(migration).toMatch(/\bencryption_version\s+text\b/i);
  });
});