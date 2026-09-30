import type { Platform, Role } from "@prisma/client";
import { modelRepository } from "@/repositories/model.repository";
import { userRepository } from "@/repositories/user.repository";
import { activityRepository } from "@/repositories/activity.repository";
import { assertCan } from "@/lib/permissions";
import { computeDaysRemaining } from "@/lib/contentStock";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

function computeInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Status is derived live from the same days-remaining computation as the
// Dashboard's ring gauges — not the stored Model.status, which would drift
// out of sync with the actual queue as videos move through stages.
function computeStatus(days: number): "OK" | "WARN" | "CRIT" {
  return days < 3 ? "CRIT" : days < 7 ? "WARN" : "OK";
}

// Same 6 core profile fields checked on the model detail page's "Fiche
// modèle" section — kept in one place so the list and detail page can never
// disagree about what "complete" means.
const PROFILE_FIELDS_FOR_COMPLETENESS = ["legalName", "birthDate", "stageName", "personalEmail", "personalPhone", "country"] as const;

export async function listModelsForGrid(agencyId?: string | null) {
  const models = await modelRepository.findMany(agencyId);
  return models.map((m) => {
    const days = computeDaysRemaining(m.videos);
    const missingProfileFieldCount = PROFILE_FIELDS_FOR_COMPLETENESS.filter((field) => !m[field]).length;
    return {
      id: m.id,
      name: m.name,
      teamName: m.team?.name ?? "—",
      initials: computeInitials(m.name),
      platformCodes: m.socialAccounts.map((sa) => sa.platform.slice(0, 2)),
      videoCount: m.videos.length,
      daysRemaining: days,
      status: computeStatus(days),
      accessCode: m.accessCode,
      missingProfileFieldCount,
    };
  });
}

export async function getModelDetail(modelId: string, agencyId?: string | null) {
  const model = await modelRepository.findById(modelId);
  if (!model) return null;

  const days = computeDaysRemaining(model.videos);
  const videosByStage = model.videos.reduce<Record<string, number>>((acc, v) => {
    acc[v.stage] = (acc[v.stage] ?? 0) + 1;
    return acc;
  }, {});

  const [activity, agencyUsers] = await Promise.all([
    activityRepository.findRecent(10, agencyId ?? model.agencyId, modelId),
    userRepository.findMany(agencyId ?? model.agencyId),
  ]);

  const assignedUserIds = new Set(model.assignments.map((a) => a.userId));
  const assignableUsers = agencyUsers.filter((u) => !assignedUserIds.has(u.id));

  return {
    id: model.id,
    name: model.name,
    notes: model.notes,
    teamName: model.team?.name ?? "—",
    initials: computeInitials(model.name),
    videoCount: model.videos.length,
    daysRemaining: days,
    status: computeStatus(days),
    accessCode: model.accessCode,
    agencyId: model.agencyId,
    driveFolderId: model.driveFolderId,
    driveInternalFolderId: model.driveInternalFolderId,
    profile: {
      legalName: model.legalName,
      birthDate: model.birthDate,
      stageName: model.stageName,
      personalEmail: model.personalEmail,
      personalPhone: model.personalPhone,
      country: model.country,
      onboardingStartDate: model.onboardingStartDate,
      relationshipStatus: model.relationshipStatus,
      managerName: model.managerName,
      importantNotes: model.importantNotes,
      telegramHandle: model.telegramHandle,
      workGroupRef: model.workGroupRef,
      vipChannelRef: model.vipChannelRef,
      whatsapp: model.whatsapp,
      directEmail: model.directEmail,
      contractUrl: model.contractUrl,
      legalDocumentsUrl: model.legalDocumentsUrl,
      agencyCommissionPercent: model.agencyCommissionPercent,
      modelPercent: model.modelPercent,
      paymentMethod: model.paymentMethod,
      pendingAmount: model.pendingAmount,
      paidAmountHistoric: model.paidAmountHistoric,
      contractStatus: model.contractStatus,
      onboardingCompleted: model.onboardingCompleted,
      editorAssignedName: model.editorAssignedName,
      chatterAssignedName: model.chatterAssignedName,
      scripterAssignedName: model.scripterAssignedName,
      nextTask: model.nextTask,
      nextImportantDate: model.nextImportantDate,
      generalNotes: model.generalNotes,
    },
    videosByStage,
    // Never pass loginPasswordEnc to the page payload, even encrypted — the
    // ciphertext has no reason to reach the client at all. hasPassword lets
    // the UI show a "Reveal" control only when one actually exists.
    socialAccounts: model.socialAccounts.map((sa) => ({
      id: sa.id,
      platform: sa.platform,
      displayName: sa.displayName,
      source: sa.source,
      isActive: sa.isActive,
      isMotherAccount: sa.isMotherAccount,
      loginIdentifier: sa.loginIdentifier,
      hasPassword: !!sa.loginPasswordEnc,
    })),
    links: model.links,
    assignments: model.assignments,
    assignableUsers,
    activity,
  };
}

export function updateModelNotes(modelId: string, notes: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.updateNotes(modelId, notes);
}

export function addModelLink(modelId: string, label: string, url: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.addLink(modelId, label, url);
}

export function removeModelLink(linkId: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.removeLink(linkId);
}

export function assignModelUser(modelId: string, userId: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.addAssignment(modelId, userId);
}

export function unassignModelUser(assignmentId: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.removeAssignment(assignmentId);
}

// ─────────────────────────────────────────────────────────────
// Per-account platform login access ("Phase 1" per the agency's own
// request: store real per-account credentials now, ready for a future
// daily-form auto-fill; manual entry only in this phase). Reuses the
// existing AES-256-GCM crypto helper (src/lib/crypto.ts) already used for
// BlotatoAccount.apiKey — no new credential system. The password is never
// returned decrypted except via revealSocialAccountPassword(), which is
// itself permission- and agency-gated.
// ─────────────────────────────────────────────────────────────

export async function addSocialAccountAccess(
  modelId: string,
  input: { platform: Platform; displayName: string | null; isMotherAccount: boolean; loginIdentifier: string | null; loginPassword: string | null },
  actorRole: Role,
) {
  assertCan(actorRole, "gererModels");
  return modelRepository.addSocialAccountAccess({
    modelId,
    platform: input.platform,
    displayName: input.displayName,
    isMotherAccount: input.isMotherAccount,
    loginIdentifier: input.loginIdentifier,
    loginPasswordEnc: input.loginPassword ? encryptSecret(input.loginPassword) : null,
  });
}

export function removeSocialAccountAccess(accountId: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  return modelRepository.removeSocialAccount(accountId);
}

/** The only function in the app that ever decrypts an account login password. Agency isolation checked by the caller (same pattern as findLinkById/findAssignmentById). */
export async function revealSocialAccountPassword(accountId: string, actorRole: Role) {
  assertCan(actorRole, "gererModels");
  const account = await modelRepository.findSocialAccountById(accountId);
  if (!account?.loginPasswordEnc) return null;
  return decryptSecret(account.loginPasswordEnc);
}
