import { clientRepository } from "@/repositories/client.repository";

export async function listClientsForGrid() {
  const clients = await clientRepository.findMany();
  return clients.map((c) => {
    const queued = c.videos.filter((v) => v.stage !== "PUBLIE").length;
    const days = Math.max(0.5, Math.round(queued * 1.8 * 10) / 10);
    const initials = c.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const platformCodes = c.socialAccounts.map((sa) => sa.platform.slice(0, 2));
    // Status is derived live from the same days-remaining computation as the
    // Dashboard's ring gauges — not the stored Client.status, which would
    // drift out of sync with the actual queue as videos move through stages.
    const status = days < 3 ? "CRIT" : days < 7 ? "WARN" : "OK";
    return {
      id: c.id,
      name: c.name,
      teamName: c.team?.name ?? "—",
      initials,
      platformCodes,
      videoCount: c.videos.length,
      daysRemaining: days,
      status,
    };
  });
}
