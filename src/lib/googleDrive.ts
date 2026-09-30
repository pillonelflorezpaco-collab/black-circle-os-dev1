import { google } from "googleapis";

/**
 * Server-only Google Drive client, authenticated as the "blackos-drive-reader"
 * service account — shared explicitly on the OFM/Interno folders as an
 * Editor (never on the user's whole Drive), which is what lets
 * moveDriveFile() below actually relocate files rather than just list them.
 * The private key lives only in the GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY env var
 * (never committed, never logged) — this file is the only place that reads it.
 */

let cachedDrive: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (cachedDrive) return cachedDrive;

  const rawKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY is not set — required for Drive access.");
  }
  const credentials = JSON.parse(rawKey);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_ENTRIES = 100; // bounded read — this is a browser, not a bulk export

/** Lists the direct children of a Drive folder — one bounded, read-only call. Never recurses on its own; the caller decides whether to descend. */
export async function listDriveFolderChildren(folderId: string): Promise<DriveEntry[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, modifiedTime, size, webViewLink, thumbnailLink)",
    orderBy: "folder,name_natural",
    pageSize: MAX_ENTRIES,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? "(sans nom)",
    mimeType: f.mimeType ?? "",
    isFolder: f.mimeType === FOLDER_MIME,
    modifiedTime: f.modifiedTime ?? null,
    sizeBytes: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
  }));
}

/** Finds a direct child folder of `parentId` by exact name, or null if there isn't one. */
export async function findChildFolderByName(parentId: string, name: string): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false and mimeType = '${FOLDER_MIME}' and name = '${name.replace(/'/g, "\\'")}'`,
    fields: "files(id)",
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

/** Moves a file from one Drive folder to another (removes the old parent, adds the new one) — a real relocation, not a copy. Requires the service account to have Editor access on both folders. */
export async function moveDriveFile(fileId: string, fromParentId: string, toParentId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    addParents: toParentId,
    removeParents: fromParentId,
    fields: "id, parents",
  });
}
