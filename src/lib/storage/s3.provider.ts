import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage, StoredObject } from "./storage";

/**
 * S3-compatible storage — works unmodified against MinIO (self-hosted on the
 * VPS) or Cloudflare R2, since both speak the S3 API. Which one is in use is
 * purely an env var choice (STORAGE_ENDPOINT/STORAGE_REGION), not a code
 * branch — see .env.example for the two configurations.
 */
export class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const bucket = process.env.STORAGE_BUCKET;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "Storage is not configured — STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET must all be set.",
      );
    }
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region: process.env.STORAGE_REGION ?? "auto",
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== "false", // MinIO needs path-style; R2 accepts either
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async put(params: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<StoredObject> {
    // Upload (not PutObjectCommand directly) handles multipart transparently for larger video files.
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      },
    });
    await upload.done();
    return { storageKey: params.key, sizeBytes: params.body.byteLength };
  }

  async getUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let instance: S3Storage | undefined;

/** Lazy singleton — constructed on first use so routes that never touch storage never require the env vars. */
export function getStorage(): Storage {
  if (!instance) instance = new S3Storage();
  return instance;
}
