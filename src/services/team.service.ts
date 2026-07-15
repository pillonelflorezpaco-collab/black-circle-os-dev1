import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { userRepository } from "@/repositories/user.repository";
import { assertCan } from "@/lib/permissions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ASSISTANT: "Assistant",
  MONTEUR: "Monteur",
  VIEWER: "Viewer",
};

export async function listTeamMembers() {
  const users = await userRepository.findMany();
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
  actorRole: Role
) {
  assertCan(actorRole, "gererEquipe");
  const passwordHash = await bcrypt.hash(input.password, 10);
  return userRepository.create({ name: input.name, email: input.email, passwordHash, role: input.role });
}

export async function updateTeamMemberRole(userId: string, role: Role, actorRole: Role) {
  assertCan(actorRole, "gererEquipe");
  return userRepository.update(userId, { role });
}

export async function removeTeamMember(userId: string, actorRole: Role) {
  assertCan(actorRole, "gererEquipe");
  return userRepository.delete(userId);
}
