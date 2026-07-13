import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "voirClients",
  "editerPipeline",
  "validerVideos",
  "publier",
  "gererEquipe",
  "facturation",
  "automatisations",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Record<Permission, boolean>> = {
  ADMIN: {
    voirClients: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    gererEquipe: true,
    facturation: true,
    automatisations: true,
  },
  MANAGER: {
    voirClients: true,
    editerPipeline: true,
    validerVideos: true,
    publier: true,
    gererEquipe: true,
    facturation: false,
    automatisations: true,
  },
  ASSISTANT: {
    voirClients: true,
    editerPipeline: true,
    validerVideos: false,
    publier: false,
    gererEquipe: false,
    facturation: false,
    automatisations: false,
  },
  MONTEUR: {
    voirClients: true,
    editerPipeline: true,
    validerVideos: false,
    publier: false,
    gererEquipe: false,
    facturation: false,
    automatisations: false,
  },
  VIEWER: {
    voirClients: true,
    editerPipeline: false,
    validerVideos: false,
    publier: false,
    gererEquipe: false,
    facturation: false,
    automatisations: false,
  },
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role][permission];
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
