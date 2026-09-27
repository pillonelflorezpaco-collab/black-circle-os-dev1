import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "voirAgences",
  "gererAgences",
  "voirModels",
  "gererModels",
  "editerPipeline",
  "validerVideos",
  "publier",
  "voirCalendrier",
  "gererEquipe",
  "facturation",
  "automatisations",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_FALSE: Record<Permission, boolean> = {
  voirAgences: false,
  gererAgences: false,
  voirModels: false,
  gererModels: false,
  editerPipeline: false,
  validerVideos: false,
  publier: false,
  voirCalendrier: false,
  gererEquipe: false,
  facturation: false,
  automatisations: false,
};

const MATRIX: Record<Role, Record<Permission, boolean>> = {
  SUPER_ADMIN: {
    voirAgences: true,
    gererAgences: true,
    voirModels: true,
    gererModels: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    voirCalendrier: true,
    gererEquipe: true,
    facturation: true,
    automatisations: true,
  },
  OWNER: {
    ...ALL_FALSE,
    voirModels: true,
    gererModels: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    voirCalendrier: true,
    gererEquipe: true,
    facturation: true,
    automatisations: true,
  },
  AGENCY_MANAGER: {
    ...ALL_FALSE,
    voirModels: true,
    gererModels: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    voirCalendrier: true,
    gererEquipe: true,
    automatisations: true,
  },
  CONTENT_MANAGER: {
    ...ALL_FALSE,
    voirModels: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    voirCalendrier: true,
  },
  EDITOR: {
    ...ALL_FALSE,
    voirModels: true,
    editerPipeline: true,
    voirCalendrier: true,
  },
  VIDEO_EDITOR: {
    ...ALL_FALSE,
    voirModels: true,
    editerPipeline: true,
    voirCalendrier: true,
  },
  ASSISTANT: {
    ...ALL_FALSE,
    voirModels: true,
    editerPipeline: true,
  },
  // TODO(phase-2): real permissions once Closer/Sales/Chatter/Finance/Developer
  // workflows are actually built — conservative read-only-ish defaults for now
  // rather than guessing boundaries for roles outside this MVP's scope.
  CLOSER: { ...ALL_FALSE, voirModels: true },
  SALES: { ...ALL_FALSE, voirModels: true },
  CHATTER_MANAGER: { ...ALL_FALSE, voirModels: true },
  CHATTER: { ...ALL_FALSE, voirModels: true },
  MODEL_ROLE: { ...ALL_FALSE },
  FINANCE: { ...ALL_FALSE, voirModels: true, facturation: true },
  DEVELOPER: { ...ALL_FALSE, voirModels: true, automatisations: true },
  VIEWER: { ...ALL_FALSE, voirModels: true },
};

export function can(role: Role, permission: Permission): boolean {
  // MATRIX[role] can be missing if a session's JWT still carries a role
  // string from before a Role enum rename (e.g. old "MANAGER" sessions after
  // it was renamed to "AGENCY_MANAGER") — the cookie's signature is still
  // valid, so NextAuth accepts it, but the string is no longer a known key.
  // Fail closed (deny) instead of throwing and taking the whole page down;
  // the user just needs to log out/in to get a fresh token.
  return MATRIX[role]?.[permission] ?? false;
}

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError();
  }
}

/**
 * Defense-in-depth for the id-supplied-by-client + fetch-then-mutate pattern:
 * confirms the record the caller just loaded actually belongs to the acting
 * session's agency before any mutation proceeds. A Super Admin (agencyId
 * null) is exempt — the "cross-agency" case is expected for that role.
 */
export function assertSameAgency(sessionAgencyId: string | null | undefined, recordAgencyId: string | null | undefined): void {
  if (sessionAgencyId === null || sessionAgencyId === undefined) return; // Super Admin
  if (sessionAgencyId !== recordAgencyId) {
    throw new ForbiddenError("Cette ressource n'appartient pas à votre agence.");
  }
}
