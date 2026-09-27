import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { userRepository } from "@/repositories/user.repository";
import { assertCan, assertSameAgency } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  AGENCY_MANAGER: "Agency Manager",
  CLOSER: "Closer",
  SALES: "Sales",
  CHATTER_MANAGER: "Chatter Manager",
  CHATTER: "Chatter",
  CONTENT_MANAGER: "Content Manager",
  EDITOR: "Editor",
  VIDEO_EDITOR: "Video Editor",
  ASSISTANT: "Assistant",
  MODEL_ROLE: "Model",
  FINANCE: "Finance",
  DEVELOPER: "Developer",
  VIEWER: "Viewer",
};

export async function listTeamMembers(agencyId?: string | null) {
  const users = await userRepository.findMany(agencyId);
  return users.map((u) => {
    const videosInProgress = u.assignedVideos.filter((v) =>
      ["A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW"].includes(v.stage)
    ).length;
    // Workload placeholder until real time-tracking exists: scales with active assignment count.
    const load = Math.min(100, videosInProgress * 22 + 10);
    const initials = u.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role] ?? u.role,
      initials,
      videosInProgress,
      load,
      updatedAt: u.updatedAt,
    };
  });
}

export async function createTeamMember(
  input: { name: string; email: string; password: string; role: Role },
  actorRole: Role,
  agencyId: string
) {
  assertCan(actorRole, "gererEquipe");
  const passwordHash = await bcrypt.hash(input.password, 10);
  return userRepository.create({ name: input.name, email: input.email, passwordHash, role: input.role, agency: { connect: { id: agencyId } } });
}

export async function updateTeamMemberRole(userId: string, role: Role, actorRole: Role, actingAgencyId: string | null) {
  assertCan(actorRole, "gererEquipe");
  const target = await userRepository.findById(userId);
  assertSameAgency(actingAgencyId, target?.agencyId);
  return userRepository.update(userId, { role });
}

export async function removeTeamMember(userId: string, actorRole: Role, actingAgencyId: string | null) {
  assertCan(actorRole, "gererEquipe");
  const target = await userRepository.findById(userId);
  assertSameAgency(actingAgencyId, target?.agencyId);
  return userRepository.delete(userId);
}
