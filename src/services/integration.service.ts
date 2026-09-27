import { integrationRepository } from "@/repositories/integration.repository";

const LABELS: Record<string, { icon: string; description: string }> = {
  GOOGLE_DRIVE: { icon: "drive", description: "Source des rushs vidéo par model" },
  GOOGLE_CALENDAR: { icon: "calendar", description: "Calendrier partagé — rappels de review" },
  N8N: { icon: "flow", description: "Orchestration des workflows de publication" },
  BLOTATO: { icon: "send", description: "Publication et analytics multi-plateforme" },
  TELEGRAM: { icon: "bell", description: "Notifications d'équipe en temps réel" },
  GOOGLE_SHEETS: { icon: "sheet", description: "Export des rapports de performance" },
  CUSTOM_API: { icon: "api", description: "Webhook sortant pour outils internes" },
};

export async function listIntegrations(agencyId: string) {
  const integrations = await integrationRepository.findMany(agencyId);
  return integrations.map((i) => ({
    ...i,
    icon: LABELS[i.type]?.icon ?? "api",
    description: LABELS[i.type]?.description ?? "",
  }));
}
