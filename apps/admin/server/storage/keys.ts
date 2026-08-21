import path from "node:path";

export function assetObjectKey(appId: string, assetId: string, fileName: string): string {
  return `apps/${safeSegment(appId)}/assets/${safeSegment(assetId)}/${safeFileName(fileName)}`;
}

export function releaseObjectKey(appId: string, releaseId: string): string {
  return `apps/${safeSegment(appId)}/releases/${safeSegment(releaseId)}/document.json`;
}

export function safeFileName(fileName: string): string {
  const base = path.basename(fileName).normalize("NFKC");
  const value = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return value && value !== "." && value !== ".." ? value : "upload.bin";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
