import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Derive a stable 32-byte AES key from the configured encryption secret.
 * The secret may be any length; SHA-256 gives us a fixed-size key.
 */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Encrypt a plaintext secret (e.g. S3 secret access key or AI provider API key) at rest.
 * Output is `iv.authTag.ciphertext`, each segment base64url encoded.
 * The encryption secret is never stored.
 */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a value produced by {@link encryptSecret}. Throws if the payload is
 * malformed or the authentication tag does not verify (wrong key / tampering).
 */
export function decryptSecret(payload: string, secret: string): string {
  const key = deriveKey(secret);
  const [iv, authTag, ciphertext] = payload.split(".");
  if (!iv || !authTag || !ciphertext) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
