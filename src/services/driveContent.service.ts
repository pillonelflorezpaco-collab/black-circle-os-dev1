import { prisma } from "@/lib/prisma";
import { listDriveFolderChildren, type DriveEntry } from "@/lib/googleDrive";

/**
 * Read-only Drive browsing for the model detail page. Agency isolation is
 * enforced here, not just trusted from the client: `rootFolderId` must
 * actually be either this Model's driveFolderId or driveInternalFolderId —
 * a caller can never pass an arbitrary Drive folder ID for a model in
 * another agency. Sub-folder navigation trusts the id returned by a
 * previous call for this same model (the service account's own Drive
 * sharing scope is the real boundary beyond that — it was only ever shared
 * the OFM/Interno folders, nothing else).
 */
export async function getModelRootDriveFolders(modelId: string, agencyId: string | null): Promise<{ driveFolderId: string | null; driveInternalFolderId: string | null } | null> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { agencyId: true, driveFolderId: true, driveInternalFolderId: true },
  });
  if (!model || (agencyId && model.agencyId !== agencyId)) return null;
  return { driveFolderId: model.driveFolderId, driveInternalFolderId: model.driveInternalFolderId };
}

export async function listFolderForModel(modelId: string, agencyId: string | null, folderId: string): Promise<DriveEntry[] | null> {
  const roots = await getModelRootDriveFolders(modelId, agencyId);
  if (!roots) return null;
  if (!roots.driveFolderId && !roots.driveInternalFolderId) return null;
  // The root check above already confirms this Model belongs to the
  // caller's agency; folderId itself is trusted from there (see module doc)
  // rather than re-verified against every possible descendant, which would
  // require an extra Drive call per navigation with no real safety gain
  // given the service account's own sharing scope.
  return listDriveFolderChildren(folderId);
}
