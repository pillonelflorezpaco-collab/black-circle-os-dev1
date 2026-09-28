"use client";

import { useMemo, useState } from "react";
import {
  SECTORS,
  agentsBySector,
  peopleBySector,
  type EcosystemPerson,
} from "@/lib/ecosystem-mock-data";
import { buildOuterBelt } from "@/lib/ecosystem-decor";
import { BRAND_ICONS } from "./BrandIcon";
import { PersonPanel } from "./PersonPanel";

const WIDTH = 900;
const HEIGHT = 640;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 - 10 };
const SECTOR_RADIUS = 150;
const LEAF_RADIUS = 250;
const LEAF_SPREAD_DEG = 46; // arc width (degrees) each sector's leaves fan across
const ORBIT_RADII = [SECTOR_RADIUS + 40, LEAF_RADIUS + 15];

function sectorPosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER.x + SECTOR_RADIUS * Math.cos(angle),
    y: CENTER.y + SECTOR_RADIUS * Math.sin(angle),
    angle,
  };
}

function leafPositions(centerAngle: number, count: number) {
  if (count === 0) return [];
  const spread = (LEAF_SPREAD_DEG * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const angle = centerAngle + t * spread;
    return {
      x: CENTER.x + LEAF_RADIUS * Math.cos(angle),
      y: CENTER.y + LEAF_RADIUS * Math.sin(angle),
    };
  });
}

export function EcosystemGraph() {
  const [activeSectorId, setActiveSectorId] = useState<string | null>(null);
  const [activePerson, setActivePerson] = useState<EcosystemPerson | null>(null);

  const sectorNodes = useMemo(
    () => SECTORS.map((sector, i) => ({ sector, pos: sectorPosition(i, SECTORS.length) })),
    []
  );
  const outerBelt = useMemo(() => buildOuterBelt(34), []);

  const activeSector = sectorNodes.find((s) => s.sector.id === activeSectorId) ?? null;
  const activeAgents = activeSectorId ? agentsBySector(activeSectorId) : [];
  const activePeople = activeSectorId ? peopleBySector(activeSectorId) : [];
  const leaves = activeSector
    ? leafPositions(activeSector.pos.angle, activeAgents.length + activePeople.length)
    : [];

  return (
    <>
      <div className="bc-eco-stats">
        <div className="bc-eco-stat"><span className="n">{SECTORS.length}</span><span className="lab">Secteurs</span></div>
        <div className="bc-eco-stat"><span className="n">6</span><span className="lab">Agents (n8n)</span></div>
        <div className="bc-eco-stat"><span className="n">{6}</span><span className="lab">Personnes</span></div>
        <div className="bc-eco-stat"><span className="n">1</span><span className="lab">Assistant central</span></div>
      </div>

      <div className="bc-eco-wrap">
        <svg className="bc-eco-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <defs>
            <radialGradient id="eco-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--bc-amber)" stopOpacity="0.32" />
              <stop offset="45%" stopColor="var(--bc-amber)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--bc-amber)" stopOpacity="0" />
            </radialGradient>
            <filter id="eco-blur-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter id="eco-blur-tight" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>

          {/* ambient glow behind Jarvis (pulses gently) */}
          <circle className="bc-eco-pulse" cx={CENTER.x} cy={CENTER.y} r={220} fill="url(#eco-core-glow)" />

          {/* decorative orbit rings (dotted) */}
          {ORBIT_RADII.map((r) => (
            <circle
              key={r}
              cx={CENTER.x}
              cy={CENTER.y}
              r={r}
              fill="none"
              stroke="var(--bc-amber-dim)"
              strokeWidth={1}
              strokeDasharray="1.5 9"
              opacity={0.35}
            />
          ))}

          {/* decorative outer belt of unassigned tool glyphs — real brand colors, drifts slowly */}
          <g className="bc-eco-belt-spin" style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}>
            {outerBelt.map((d, i) => {
              const rad = (d.angleDeg * Math.PI) / 180;
              const x = Math.round(CENTER.x + d.radius * Math.cos(rad));
              const y = Math.round(CENTER.y + d.radius * Math.sin(rad));
              if (y > HEIGHT + 20 || y < -20) return null;
              const Icon = BRAND_ICONS[d.iconId];
              const iconSize = d.size * 0.85;
              return (
                <g key={i} transform={`translate(${x}, ${y})`} opacity={d.opacity}>
                  <polygon points={hexPoints(d.size)} fill="var(--bc-surface-2)" stroke={d.color} strokeWidth={1} strokeOpacity={0.8} />
                  {Icon && (
                    <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
                      <Icon color={d.color} size={iconSize} />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* links: Jarvis -> sectors */}
          {sectorNodes.map(({ sector, pos }) => (
            <line
              key={`link-${sector.id}`}
              className={`bc-eco-link${activeSectorId === sector.id ? " bc-eco-link-active" : ""}`}
              x1={CENTER.x}
              y1={CENTER.y}
              x2={pos.x}
              y2={pos.y}
              stroke={activeSectorId === sector.id ? sector.color : undefined}
              filter={activeSectorId === sector.id ? "url(#eco-blur-tight)" : undefined}
            />
          ))}

          {/* links: active sector -> its leaves */}
          {activeSector &&
            leaves.map((leaf, i) => (
              <line
                key={`leaf-link-${i}`}
                className="bc-eco-link bc-eco-link-active"
                stroke={activeSector.sector.color}
                x1={activeSector.pos.x}
                y1={activeSector.pos.y}
                x2={leaf.x}
                y2={leaf.y}
              />
            ))}

          {/* Jarvis core */}
          <g className="bc-eco-node-core" transform={`translate(${CENTER.x}, ${CENTER.y})`}>
            <circle r={34} fill="var(--bc-amber)" opacity={0.16} filter="url(#eco-blur-soft)" />
            <circle r={30} fill="#0b0b0b" stroke="var(--bc-amber)" strokeWidth={1.5} />
            <circle r={4} fill="var(--bc-amber)" />
            <text className="bc-eco-label-core" y={48} textAnchor="middle" fontSize={13}>
              Jarvis
            </text>
          </g>

          {/* Sector nodes */}
          {sectorNodes.map(({ sector, pos }) => {
            const isActive = activeSectorId === sector.id;
            return (
              <g
                key={sector.id}
                className="bc-eco-node-sector"
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => setActiveSectorId(isActive ? null : sector.id)}
              >
                {isActive && <circle className="bc-eco-pulse" r={30} fill={sector.color} opacity={0.28} filter="url(#eco-blur-soft)" />}
                <circle
                  r={22}
                  fill={isActive ? sector.color : "#0b0b0b"}
                  fillOpacity={isActive ? 0.16 : 1}
                  stroke={sector.color}
                  strokeWidth={1.5}
                />
                <text textAnchor="middle" dominantBaseline="central" fontSize={14} fill={sector.color}>
                  {sector.icon}
                </text>
                <text className="bc-eco-label" y={40} textAnchor="middle" fontSize={10.5}>
                  {sector.name}
                </text>
              </g>
            );
          })}

          {/* Leaves: agents + people for the active sector */}
          {activeSector &&
            activeAgents.map((agent, i) => {
              const pos = leaves[i];
              return (
                <g
                  key={agent.id}
                  className="bc-eco-node-leaf"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  opacity={agent.status === "paused" ? 0.55 : 1}
                >
                  <rect x={-16} y={-16} width={32} height={32} rx={9} fill="var(--bc-surface-2)" stroke="var(--bc-border)" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--bc-text-dim)" fontFamily="var(--font-jbmono)">
                    {agent.icon}
                  </text>
                  <text className="bc-eco-label" y={30} textAnchor="middle" fontSize={9.5}>
                    {agent.name}
                  </text>
                </g>
              );
            })}
          {activeSector &&
            activePeople.map((person, i) => {
              const pos = leaves[activeAgents.length + i];
              return (
                <g
                  key={person.id}
                  className="bc-eco-node-leaf"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePerson(person);
                  }}
                >
                  <circle r={20} fill="var(--bc-amber)" opacity={0.18} filter="url(#eco-blur-tight)" />
                  <circle r={17} fill="var(--bc-surface-2)" stroke="var(--bc-amber-dim)" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="var(--bc-amber)" fontFamily="var(--font-fraunces)" fontStyle="italic">
                    {person.initial}
                  </text>
                  <text className="bc-eco-label" y={32} textAnchor="middle" fontSize={9.5}>
                    {person.name.split(" ")[0]}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {activePerson && <PersonPanel person={activePerson} onClose={() => setActivePerson(null)} />}
    </>
  );
}

function hexPoints(size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${(size * Math.cos(angle)).toFixed(1)},${(size * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}
