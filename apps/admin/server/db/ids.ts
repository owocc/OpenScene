import { createHash, randomBytes, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function newSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}
