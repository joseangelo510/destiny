import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const REPURPOSE_ENCRYPTION_VERSION = "aes-256-gcm-v1";
const AAD = Buffer.from(`destiny:repurpose-source:${REPURPOSE_ENCRYPTION_VERSION}`, "utf8");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class RepurposeCryptoError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_SECRET" | "INVALID_CIPHERTEXT",
  ) {
    super(message);
    this.name = "RepurposeCryptoError";
  }
}

function encryptionKey(secret: string) {
  if (!secret.trim()) {
    throw new RepurposeCryptoError(
      "Repurpose source encryption is not configured.",
      "MISSING_SECRET",
    );
  }
  return createHash("sha256")
    .update("destiny:repurpose-source:key:v1\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

export function encryptRepurposeSourceText(
  plaintext: string,
  secret: string,
): string {
  if (!plaintext) {
    throw new RepurposeCryptoError(
      "Repurpose source text cannot be empty.",
      "INVALID_CIPHERTEXT",
    );
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    REPURPOSE_ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptRepurposeSourceText(
  value: string,
  secret: string,
  version: string,
): string {
  try {
    if (version !== REPURPOSE_ENCRYPTION_VERSION) throw new Error("unsupported version");
    const [encodedVersion, ivValue, tagValue, encryptedValue, extra] = value.split(".");
    if (
      encodedVersion !== REPURPOSE_ENCRYPTION_VERSION
      || !ivValue
      || !tagValue
      || !encryptedValue
      || extra !== undefined
    ) throw new Error("invalid envelope");

    const iv = Buffer.from(ivValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    const encrypted = Buffer.from(encryptedValue, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || encrypted.length === 0) {
      throw new Error("invalid sizes");
    }

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof RepurposeCryptoError) throw error;
    throw new RepurposeCryptoError(
      "The saved source text could not be decrypted.",
      "INVALID_CIPHERTEXT",
    );
  }
}