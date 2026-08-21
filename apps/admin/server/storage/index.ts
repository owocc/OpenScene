import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { getConfig } from "../config/env";
import { unavailable } from "../errors";

export type StorageHead = { size: number; mimeType?: string; checksum?: string };
export type StorageHealth = {
  status: "up" | "down" | "not_configured";
  driver: "s3" | "memory";
  detail?: string;
};

export interface StorageAdapter {
  health(): Promise<StorageHealth>;
  createUploadIntent(input: {
    key: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }>;
  head(key: string): Promise<StorageHead | undefined>;
  put(key: string, body: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<void>;
}

class S3StorageAdapter implements StorageAdapter {
  private readonly config = getConfig().storage;
  private readonly client: S3Client | undefined =
    this.config.bucket && this.config.accessKeyId && this.config.secretAccessKey
      ? new S3Client({
          region: this.config.region,
          endpoint: this.config.endpoint,
          forcePathStyle: this.config.forcePathStyle,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
        })
      : undefined;

  async health(): Promise<StorageHealth> {
    if (!this.client || !this.config.bucket)
      return {
        status: "not_configured",
        driver: "s3",
        detail: "S3 bucket and credentials are not configured",
      };
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: "__openscene_health__" }),
      );
      return { status: "up", driver: "s3" };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "name" in error
          ? String(error.name)
          : "S3 request failed";
      if (code === "NotFound" || code === "NoSuchKey") return { status: "up", driver: "s3" };
      return { status: "down", driver: "s3", detail: "S3 health check failed" };
    }
  }

  async createUploadIntent(input: {
    key: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }> {
    this.requireConfigured();
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.mimeType,
      ContentLength: input.size,
    });
    const url = await getSignedUrl(this.client as S3Client, command, {
      expiresIn: input.expiresInSeconds,
    });
    return { url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString() };
  }

  async head(key: string): Promise<StorageHead | undefined> {
    this.requireConfigured();
    try {
      const result = await this.client?.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return result?.ContentLength === undefined
        ? undefined
        : {
            size: result.ContentLength,
            mimeType: result.ContentType,
            checksum: result.ETag?.replaceAll('"', ""),
          };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
      if (code === "NotFound" || code === "NoSuchKey") return undefined;
      throw error;
    }
  }

  async put(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    this.requireConfigured();
    await this.client?.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ContentLength: body.byteLength,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    this.requireConfigured();
    const response = await this.client?.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!response?.Body) return undefined;
    return new Uint8Array(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    this.requireConfigured();
    await this.client?.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  private requireConfigured(): void {
    if (!this.client || !this.config.bucket) throw unavailable("Object storage is not configured");
  }
}

class MemoryStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<
    string,
    { body: Uint8Array; mimeType: string; checksum: string }
  >();

  async health(): Promise<StorageHealth> {
    return { status: "up", driver: "memory" };
  }

  async createUploadIntent(input: {
    key: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }> {
    return {
      url: `memory://upload/${encodeURIComponent(input.key)}`,
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString(),
    };
  }

  async head(key: string): Promise<StorageHead | undefined> {
    const object = this.objects.get(key);
    return object
      ? { size: object.body.byteLength, mimeType: object.mimeType, checksum: object.checksum }
      : undefined;
  }

  async put(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    this.objects.set(key, { body, mimeType, checksum: await checksum(body) });
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    return this.objects.get(key)?.body;
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

let adapter: StorageAdapter | undefined;

export function getStorage(): StorageAdapter {
  if (!adapter)
    adapter =
      getConfig().storage.driver === "memory" ? new MemoryStorageAdapter() : new S3StorageAdapter();
  return adapter;
}

export function resetStorageForTests(): void {
  adapter = undefined;
}

async function checksum(body: Uint8Array): Promise<string> {
  return createHash("sha256").update(body).digest("hex");
}
