// Purely decorative "pool of unassigned tools" scattered around the outer
// edge of the ecosystem graph — mirrors the reference visual's belt of app
// icons that aren't wired to a specific person yet. No interactivity, no
// data behind it, but real brand colors so it reads as an actual tool pool
// rather than abstract confetti.

export type DecorGlyph = { iconId: string; color: string; angleDeg: number; radius: number; size: number; opacity: number };

const DECOR_TOOLS: { iconId: string; color: string }[] = [
  { iconId: "slack", color: "#4A154B" },
  { iconId: "notion", color: "#EDEDED" },
  { iconId: "gmail", color: "#EA4335" },
  { iconId: "x", color: "#F2EFE8" },
  { iconId: "instagram", color: "#E1306C" },
  { iconId: "tiktok", color: "#25F4EE" },
  { iconId: "youtube", color: "#FF0000" },
  { iconId: "whatsapp", color: "#25D366" },
  { iconId: "telegram", color: "#29B6F6" },
  { iconId: "drive", color: "#4285F4" },
  { iconId: "clickup", color: "#7B68EE" },
  { iconId: "linkedin", color: "#0A66C2" },
  { iconId: "calendar", color: "#34A853" },
  { iconId: "n8n", color: "#EA4B71" },
];

function seeded(i: number) {
  // deterministic pseudo-random in [0,1), rounded so server/client renders match exactly
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return Math.round((x - Math.floor(x)) * 10000) / 10000;
}

export function buildOuterBelt(count: number): DecorGlyph[] {
  return Array.from({ length: count }, (_, i) => {
    const band = seeded(i * 3 + 1) > 0.5 ? 1 : 0;
    const angleDeg = Math.round(seeded(i * 7 + 2) * 3600) / 10;
    const radius = Math.round(300 + band * 55 + seeded(i * 11 + 3) * 40);
    const size = Math.round((9 + seeded(i * 5 + 4) * 5) * 10) / 10;
    const opacity = Math.round((0.35 + seeded(i * 13 + 5) * 0.35) * 100) / 100;
    const tool = DECOR_TOOLS[i % DECOR_TOOLS.length];
    return { iconId: tool.iconId, color: tool.color, angleDeg, radius, size, opacity };
  });
}
