import path from "node:path";

export function normalizeFolderPath(folder?: string | null): string {
  if (!folder || folder === "/") return "/";
  const cleaned = folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
  return cleaned ? `/${cleaned}` : "/";
}

export function assetObjectKey(
  appId: string,
  assetId: string,
  fileName: string,
  folder?: string | null,
): string {
  const normFolder = normalizeFolderPath(folder);
  const folderPrefix =
    normFolder === "/" ? "" : normFolder.slice(1).split("/").map(safeSegment).join("/") + "/";
  return `apps/${safeSegment(appId)}/assets/${folderPrefix}${safeSegment(assetId)}/${safeFileName(fileName)}`;
}

export function assetRelativePath(appId: string, assetId: string, _fileName?: string): string {
  return `/api/v1/apps/${safeSegment(appId)}/assets/${safeSegment(assetId)}/raw`;
}

export function releaseObjectKey(appId: string, releaseId: string): string {
  return `apps/${safeSegment(appId)}/releases/${safeSegment(releaseId)}/document.json`;
}

export function pageObjectKey(appId: string, pageKey: string): string {
  const pathSegments = pageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .join("/");
  return `apps/${safeSegment(appId)}/pages/${pathSegments || "home"}.json`;
}

export function safeFileName(fileName: string): string {
  const base = path.basename(fileName).normalize("NFKC");
  const value = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return value && value !== "." && value !== ".." ? value : "upload.bin";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
