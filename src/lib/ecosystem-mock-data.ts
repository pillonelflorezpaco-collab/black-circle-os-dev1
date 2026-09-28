// Mock data for the /ecosysteme page — visual prototype only, not wired to
// Postgres yet. Structure mirrors the real org: secteurs (départements) ->
// agents (n8n workflows) + personnes (employés/models) -> comptes/outils.

export type EcosystemTool = {
  id: string;
  name: string;
  icon: string; // single emoji/glyph, keeps this file dependency-free
  color: string; // the tool's real brand color, for instant recognition
  access: boolean;
};

export type EcosystemPerson = {
  id: string;
  kind: "person";
  name: string;
  role: string;
  sectorId: string;
  initial: string;
  since: string;
  tools: EcosystemTool[];
};

export type EcosystemAgent = {
  id: string;
  kind: "agent";
  name: string;
  sectorId: string;
  icon: string;
  status: "active" | "paused" | "draft";
};

export type EcosystemSector = {
  id: string;
  name: string;
  color: string; // CSS var, e.g. "var(--bc-amber)"
  icon: string;
};

export const SECTORS: EcosystemSector[] = [
  { id: "ofm", name: "OFM", color: "var(--bc-amber)", icon: "◆" },
  { id: "marketing", name: "Marketing Agency", color: "var(--bc-red)", icon: "▲" },
  { id: "finance", name: "Finance", color: "var(--bc-gold)", icon: "€" },
  { id: "contenu", name: "Contenu", color: "var(--bc-rose)", icon: "▶" },
  { id: "communication", name: "Communication", color: "var(--bc-blue)", icon: "◍" },
  { id: "fulfillment", name: "Fulfillment & Tech", color: "var(--bc-green)", icon: "⬡" },
];

export const AGENTS: EcosystemAgent[] = [
  { id: "wf1", name: "Onboarding Modèle", sectorId: "ofm", icon: "WF1", status: "active" },
  { id: "wf2", name: "Création Drive", sectorId: "ofm", icon: "WF2", status: "active" },
  { id: "wf3", name: "Jarvis", sectorId: "communication", icon: "WF3", status: "active" },
  { id: "wf4", name: "Sync ClickUp", sectorId: "fulfillment", icon: "WF4", status: "active" },
  { id: "wf5", name: "Résumé Diario", sectorId: "communication", icon: "WF5", status: "paused" },
  { id: "wf6", name: "Inventaire Contenu", sectorId: "contenu", icon: "WF6", status: "active" },
];

// Real brand colors — used across the ecosystem graph so each tool reads
// instantly by color, the way the reference constellation UI does.
export const TOOL_CATALOG: Record<string, { name: string; icon: string; color: string }> = {
  instagram: { name: "Instagram", icon: "IG", color: "#E1306C" },
  whatsapp: { name: "WhatsApp", icon: "WA", color: "#25D366" },
  gmail: { name: "Gmail", icon: "GM", color: "#EA4335" },
  telegram: { name: "Telegram", icon: "TG", color: "#29B6F6" },
  drive: { name: "Google Drive", icon: "GD", color: "#4285F4" },
  clickup: { name: "ClickUp", icon: "CU", color: "#7B68EE" },
  calendar: { name: "Google Calendar", icon: "GC", color: "#4285F4" },
  tiktok: { name: "TikTok", icon: "TT", color: "#25F4EE" },
  n8n: { name: "n8n", icon: "N8", color: "#EA4B71" },
};

function tools(access: Record<string, boolean>): EcosystemTool[] {
  return Object.entries(access).map(([id, granted]) => ({
    id,
    name: TOOL_CATALOG[id].name,
    icon: TOOL_CATALOG[id].icon,
    color: TOOL_CATALOG[id].color,
    access: granted,
  }));
}

export const PEOPLE: EcosystemPerson[] = [
  {
    id: "angels",
    kind: "person",
    name: "Angels Pillonel",
    role: "SUPER_ADMIN",
    sectorId: "communication",
    initial: "A",
    since: "07/2026",
    tools: tools({ instagram: true, whatsapp: true, gmail: true, telegram: true, drive: true, clickup: true, calendar: true, tiktok: true, n8n: true }),
  },
  {
    id: "sacha",
    kind: "person",
    name: "Sacha Ben",
    role: "AGENCY_MANAGER",
    sectorId: "marketing",
    initial: "S",
    since: "07/2026",
    tools: tools({ instagram: true, whatsapp: true, gmail: true, telegram: false, drive: true, clickup: true, calendar: true, tiktok: false, n8n: false }),
  },
  {
    id: "julien",
    kind: "person",
    name: "Julien Marchand",
    role: "VIDEO_EDITOR",
    sectorId: "contenu",
    initial: "J",
    since: "07/2026",
    tools: tools({ instagram: false, whatsapp: true, gmail: true, telegram: true, drive: true, clickup: true, calendar: false, tiktok: true, n8n: false }),
  },
  {
    id: "lea",
    kind: "person",
    name: "Léa Roussel",
    role: "VIDEO_EDITOR",
    sectorId: "contenu",
    initial: "L",
    since: "07/2026",
    tools: tools({ instagram: false, whatsapp: true, gmail: true, telegram: true, drive: true, clickup: true, calendar: false, tiktok: true, n8n: false }),
  },
  {
    id: "camille",
    kind: "person",
    name: "Camille Ortiz",
    role: "VIDEO_EDITOR",
    sectorId: "contenu",
    initial: "C",
    since: "07/2026",
    tools: tools({ instagram: false, whatsapp: false, gmail: true, telegram: true, drive: true, clickup: true, calendar: false, tiktok: true, n8n: false }),
  },
  {
    id: "paul",
    kind: "person",
    name: "Paul Vidal",
    role: "ASSISTANT",
    sectorId: "fulfillment",
    initial: "P",
    since: "07/2026",
    tools: tools({ instagram: false, whatsapp: true, gmail: true, telegram: true, drive: true, clickup: true, calendar: true, tiktok: false, n8n: true }),
  },
];

export function sectorById(id: string) {
  return SECTORS.find((s) => s.id === id) ?? null;
}

export function agentsBySector(sectorId: string) {
  return AGENTS.filter((a) => a.sectorId === sectorId);
}

export function peopleBySector(sectorId: string) {
  return PEOPLE.filter((p) => p.sectorId === sectorId);
}
