import type { Role } from "@prisma/client";
import { agencyRepository } from "@/repositories/agency.repository";
import { assertCan } from "@/lib/permissions";

// Combining diacritical marks are U+0300-U+036F. Filtering by code point
// (rather than a regex range literal) avoids ambiguity with how those
// combining characters render/copy in source.
function stripDiacritics(input: string): string {
  return Array.from(input)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function slugify(name: string): string {
  return stripDiacritics(name.toLowerCase().normalize("NFD"))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listAgencies(actorRole: Role) {
  assertCan(actorRole, "voirAgences");
  const agencies = await agencyRepository.findMany();
  return agencies.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    status: a.status,
    modelsCount: a._count.models,
    usersCount: a._count.users,
    teamsCount: a._count.teams,
    createdAt: a.createdAt,
  }));
}

export async function getAgency(id: string, actorRole: Role) {
  assertCan(actorRole, "voirAgences");
  return agencyRepository.findById(id);
}

export async function createAgency(input: { name: string }, actorRole: Role) {
  assertCan(actorRole, "gererAgences");
  const baseSlug = slugify(input.name) || "agence";
  let slug = baseSlug;
  let suffix = 1;
  // Simple collision avoidance — fine at this scale (a handful of agencies).
  const existing = await agencyRepository.findMany();
  const takenSlugs = new Set(existing.map((a) => a.slug));
  while (takenSlugs.has(slug)) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return agencyRepository.create({ name: input.name, slug });
}

export async function updateAgencyStatus(id: string, status: "ACTIVE" | "SUSPENDED", actorRole: Role) {
  assertCan(actorRole, "gererAgences");
  return agencyRepository.update(id, { status });
}
