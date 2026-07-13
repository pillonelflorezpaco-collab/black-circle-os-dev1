import { userRepository } from "@/repositories/user.repository";

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
      role: ROLE_LABELS[u.role] ?? u.role,
      initials,
      videosInProgress,
      load,
      updatedAt: u.updatedAt,
    };
  });
}
