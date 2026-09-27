import { randomUUID } from "crypto";

/**
 * Core file storage abstraction — the Social Engine's native uploads (and any
 * future Engine) go through this, never talk to a storage SDK directly.
 * Backed today by an S3-compatible bucket (see s3.provider.ts); swapping
 * provider means changing only that one file.
 */
export interface StoredObject {
  storageKey: string;
  sizeBytes: number;
}

export interface Storage {
  /** Streams/uploads a buffer under a fresh key, returns the key to persist (e.g. on MediaAsset.storageKey). */
  put(params: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<StoredObject>;
  /** Presigned, time-limited URL a platform adapter or the browser can fetch directly. */
  getUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function buildMediaAssetKey(params: { agencyId: string; modelId: string; videoId?: string | null }): string {
  const parts = ["media", params.agencyId, params.modelId];
  if (params.videoId) parts.push(params.videoId);
  parts.push(randomUUID());
  return parts.join("/");
}
