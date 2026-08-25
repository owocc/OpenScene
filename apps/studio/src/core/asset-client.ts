import { createOpenSceneClient } from "@openscene-ai/api-client";
import { useQueryStore } from "@/stores/query-store";
import { LOCAL_TEST_SESSION_ID } from "./local-test-session";

export interface StudioAsset {
  id: string;
  appId: string;
  status: "pending" | "ready" | "failed";
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  checksum?: string | null;
  folder: string;
  tags: string[];
  metadata?: Record<string, unknown> | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  path?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadAssetOptions {
  folder?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  width?: number;
  height?: number;
  duration?: number;
}

export async function extractMediaDimensions(file: File): Promise<{
  width?: number;
  height?: number;
  duration?: number;
}> {
  if (typeof window === "undefined") return {};

  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");

  if (isImage) {
    return new Promise<{ width?: number; height?: number }>((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const result = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      img.src = url;
    });
  }

  if (isAudio) {
    return new Promise<{ duration?: number }>((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new window.Audio();
      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration);
        URL.revokeObjectURL(url);
        resolve({ duration });
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      audio.src = url;
    });
  }

  if (isVideo) {
    return new Promise<{
      width?: number;
      height?: number;
      duration?: number;
    }>((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        const result = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration),
        };
        URL.revokeObjectURL(url);
        resolve(result);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      video.src = url;
    });
  }

  return {};
}

let localMockAssets: StudioAsset[] = [
  {
    id: "ast_demo_logo",
    appId: "app_demo",
    status: "ready",
    fileName: "logo.svg",
    mimeType: "image/svg+xml",
    size: 2048,
    storageKey: "apps/app_demo/assets/icons/ast_demo_logo/logo.svg",
    folder: "/icons",
    tags: ["logo", "brand", "vector"],
    width: 200,
    height: 200,
    path: "/assets/ast_demo_logo/logo.svg",
    url: "/assets/ast_demo_logo/logo.svg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ast_demo_banner",
    appId: "app_demo",
    status: "ready",
    fileName: "hero-banner.jpg",
    mimeType: "image/jpeg",
    size: 154200,
    storageKey: "apps/app_demo/assets/images/ast_demo_banner/hero-banner.jpg",
    folder: "/images",
    tags: ["hero", "banner", "landscape"],
    width: 1920,
    height: 1080,
    path: "/assets/ast_demo_banner/hero-banner.jpg",
    url: "/assets/ast_demo_banner/hero-banner.jpg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ast_demo_bgm",
    appId: "app_demo",
    status: "ready",
    fileName: "ambient-loop.mp3",
    mimeType: "audio/mp3",
    size: 2450000,
    storageKey: "apps/app_demo/assets/audio/ast_demo_bgm/ambient-loop.mp3",
    folder: "/audio",
    tags: ["bgm", "music", "ambient"],
    duration: 78,
    path: "/assets/ast_demo_bgm/ambient-loop.mp3",
    url: "/assets/ast_demo_bgm/ambient-loop.mp3",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function fetchStudioAssets(options?: {
  folder?: string;
  tag?: string;
  type?: string;
  q?: string;
}): Promise<StudioAsset[]> {
  const query = useQueryStore.getState();

  if (query.sessionId === LOCAL_TEST_SESSION_ID || !query.serverUrl || !query.token) {
    let filtered = [...localMockAssets];
    if (options?.folder && options.folder !== "") {
      filtered = filtered.filter((a) => a.folder === options.folder);
    }
    if (options?.type && options.type !== "all") {
      if (options.type === "image")
        filtered = filtered.filter((a) => a.mimeType.startsWith("image/"));
      else if (options.type === "audio")
        filtered = filtered.filter((a) => a.mimeType.startsWith("audio/"));
      else if (options.type === "video")
        filtered = filtered.filter((a) => a.mimeType.startsWith("video/"));
    }
    if (options?.tag) {
      const tagLower = options.tag.toLowerCase();
      filtered = filtered.filter((a) => a.tags.some((t) => t.toLowerCase() === tagLower));
    }
    if (options?.q) {
      const qLower = options.q.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.fileName.toLowerCase().includes(qLower) ||
          a.folder.toLowerCase().includes(qLower) ||
          a.tags.some((t) => t.toLowerCase().includes(qLower)),
      );
    }
    return filtered;
  }

  const client = createOpenSceneClient({
    baseUrl: query.serverUrl.replace(/\/$/, ""),
    headers: { "x-openscene-session-token": query.token },
  });

  const queryParams: Record<string, string> = {};
  if (options?.folder) queryParams.folder = options.folder;
  if (options?.tag) queryParams.tag = options.tag;
  if (options?.type) queryParams.type = options.type;
  if (options?.q) queryParams.q = options.q;

  const res = await client.GET("/api/v1/studio-sessions/{sessionId}/assets", {
    params: {
      path: { sessionId: query.sessionId || "" },
      query: queryParams as never,
    },
  });

  if (res.error || !res.data) {
    console.warn("Failed to fetch session assets:", res.error);
    return [];
  }

  return res.data as unknown as StudioAsset[];
}

export async function fetchStudioAssetFolders(): Promise<string[]> {
  const query = useQueryStore.getState();

  if (query.sessionId === LOCAL_TEST_SESSION_ID || !query.serverUrl || !query.token) {
    const folders = new Set<string>(["/"]);
    for (const a of localMockAssets) {
      if (a.folder) folders.add(a.folder);
    }
    return Array.from(folders).sort();
  }

  const client = createOpenSceneClient({
    baseUrl: query.serverUrl.replace(/\/$/, ""),
    headers: { "x-openscene-session-token": query.token },
  });

  const res = await client.GET("/api/v1/studio-sessions/{sessionId}/assets/folders", {
    params: {
      path: { sessionId: query.sessionId || "" },
    },
  });

  if (res.error || !res.data) {
    return ["/"];
  }

  return res.data as string[];
}

export async function uploadStudioAsset(
  file: File,
  options?: UploadAssetOptions,
): Promise<StudioAsset> {
  const query = useQueryStore.getState();
  const dimensions = await extractMediaDimensions(file);
  const width = options?.width ?? dimensions.width;
  const height = options?.height ?? dimensions.height;
  const duration = options?.duration ?? dimensions.duration;
  const folder = options?.folder || "/";
  const tags = options?.tags || [];
  const metadata = options?.metadata;

  if (query.sessionId === LOCAL_TEST_SESSION_ID || !query.serverUrl || !query.token) {
    const mockId = `ast_local_${Date.now()}`;
    const newAsset: StudioAsset = {
      id: mockId,
      appId: "app_local",
      status: "ready",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storageKey: `apps/app_local/assets/${mockId}/${file.name}`,
      folder,
      tags,
      metadata: metadata || null,
      width: width || null,
      height: height || null,
      duration: duration || null,
      path: `/assets/${mockId}/${file.name}`,
      url: `/assets/${mockId}/${file.name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localMockAssets = [newAsset, ...localMockAssets];
    return newAsset;
  }

  const client = createOpenSceneClient({
    baseUrl: query.serverUrl.replace(/\/$/, ""),
    headers: { "x-openscene-session-token": query.token },
  });

  // 1. Create upload intent
  const intentRes = await client.POST("/api/v1/studio-sessions/{sessionId}/assets/upload-intents", {
    params: { path: { sessionId: query.sessionId || "" } },
    body: {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      folder,
      tags,
      metadata: metadata as Record<string, unknown> | undefined,
    },
  });

  if (intentRes.error || !intentRes.data) {
    throw new Error(
      (intentRes.error as { title?: string; detail?: string })?.detail ||
        (intentRes.error as { title?: string })?.title ||
        "Failed to create upload intent",
    );
  }

  const { asset, uploadUrl } = intentRes.data;

  // 2. Upload file bytes to presigned URL
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload to storage failed (${uploadResponse.status})`);
  }

  // 3. Complete asset
  const completeRes = await client.POST(
    "/api/v1/studio-sessions/{sessionId}/assets/{assetId}/complete",
    {
      params: {
        path: {
          sessionId: query.sessionId || "",
          assetId: asset.id,
        },
      },
      body: {
        width,
        height,
        duration,
        folder,
        tags,
        metadata: metadata as Record<string, unknown> | undefined,
      },
    },
  );

  if (completeRes.error || !completeRes.data) {
    throw new Error("Failed to complete asset registration");
  }

  return completeRes.data as unknown as StudioAsset;
}
