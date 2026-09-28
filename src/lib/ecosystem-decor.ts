// Purely decorative "pool of unassigned tools" scattered around the outer
// edge of the ecosystem graph — mirrors the reference visual's belt of app
// icons that aren't wired to a specific person yet. No interactivity, no
// data behind it.

export type DecorGlyph = { glyph: string; angleDeg: number; radius: number; size: number; opacity: number };

const GLYPHS = ["S", "N", "M", "▲", "X", "R", "◧", "⟡", "◈", "▣", "◐", "⬢", "✦", "◔", "⬡", "◆", "▷", "⌘", "◎", "▪", "⚡", "◫", "✧", "⬣"];

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
    const size = Math.round((8 + seeded(i * 5 + 4) * 5) * 10) / 10;
    const opacity = Math.round((0.18 + seeded(i * 13 + 5) * 0.22) * 100) / 100;
    return { glyph: GLYPHS[i % GLYPHS.length], angleDeg, radius, size, opacity };
  });
}
