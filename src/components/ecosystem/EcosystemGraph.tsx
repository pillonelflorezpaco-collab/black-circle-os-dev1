"use client";

import { useMemo, useState } from "react";
import type { OrganizationAgent, OrganizationGraphData } from "@/types/organization";
import { buildOuterBelt } from "@/lib/ecosystem-decor";
import { BRAND_ICONS } from "./BrandIcon";
import { AgentPanel } from "./AgentPanel";

const WIDTH = 960;
const HEIGHT = 680;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 - 10 };

// Same 9-color / 9-icon palette the mock data used for its 9 sectors —
// Neo4j Department nodes don't store a color/icon (see docs/ecosystem-real-data.md),
// so this is a stable positional palette, not semantic data. Assigned by
// sorted department key, so a given department keeps the same look across loads.
const DEPARTMENT_COLORS = ["var(--bc-amber)", "var(--bc-red)", "var(--bc-gold)", "var(--bc-rose)", "var(--bc-blue)", "var(--bc-green)", "var(--bc-violet)", "var(--bc-teal)", "var(--bc-slate)"];
const DEPARTMENT_ICONS = ["◆", "▲", "€", "▶", "◍", "⬡", "◇", "▥", "⚖"];

const AGENT_TYPE_SHORT: Record<string, string> = { ORCHESTRATOR: "ORC", MANAGER: "MGR", SPECIALIST: "SPC" };

function agentGlyph(type: string) {
  return AGENT_TYPE_SHORT[type] ?? type.slice(0, 3).toUpperCase();
}

function sectorPosition(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return { x: CENTER.x + radius * Math.cos(angle), y: CENTER.y + radius * Math.sin(angle), angle };
}

function leafPositions(centerAngle: number, count: number, radius: number, spreadDeg: number) {
  if (count === 0) return [];
  const spread = (spreadDeg * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const angle = centerAngle + t * spread;
    return { x: CENTER.x + radius * Math.cos(angle), y: CENTER.y + radius * Math.sin(angle) };
  });
}

export function EcosystemGraph({ graph }: { graph: OrganizationGraphData }) {
  const [activeDeptKey, setActiveDeptKey] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<OrganizationAgent | null>(null);

  const sectorRadius = Math.max(150, 24 * graph.departments.length);
  const leafRadius = sectorRadius + 100;
  const leafSpreadDeg = 46;
  const orbitRadii = [sectorRadius + 40, leafRadius + 15];

  const sectorNodes = useMemo(
    () =>
      graph.departments.map((dept, i) => ({
        dept,
        pos: sectorPosition(i, graph.departments.length, sectorRadius),
        color: DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length],
        icon: DEPARTMENT_ICONS[i % DEPARTMENT_ICONS.length],
      })),
    [graph.departments, sectorRadius],
  );
  const outerBelt = useMemo(() => buildOuterBelt(34), []);

  const activeSector = sectorNodes.find((s) => s.dept.key === activeDeptKey) ?? null;
  const activeAgents = activeDeptKey ? graph.agents.filter((a) => a.departmentKey === activeDeptKey) : [];
  const leaves = activeSector ? leafPositions(activeSector.pos.angle, Math.max(activeAgents.length, 1), leafRadius, leafSpreadDeg) : [];

  function openAgent(agent: OrganizationAgent) {
    setActiveAgent(agent);
  }

  return (
    <>
      <div className="bc-eco-stats">
        <div className="bc-eco-stat">
          <span className="n">{graph.departments.length}</span>
          <span className="lab">Départements</span>
        </div>
        <div className="bc-eco-stat">
          <span className="n">{graph.agents.length}</span>
          <span className="lab">Agents</span>
        </div>
        <div className="bc-eco-stat">
          <span className="n">{graph.capabilities.length}</span>
          <span className="lab">Capacités</span>
        </div>
        <div className="bc-eco-stat">
          <span className="n">{graph.tools.length}</span>
          <span className="lab">Outils</span>
        </div>
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

          <circle className="bc-eco-pulse" cx={CENTER.x} cy={CENTER.y} r={220} fill="url(#eco-core-glow)" />

          {orbitRadii.map((r) => (
            <circle key={r} cx={CENTER.x} cy={CENTER.y} r={r} fill="none" stroke="var(--bc-amber-dim)" strokeWidth={1} strokeDasharray="1.5 9" opacity={0.35} />
          ))}

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

          {sectorNodes.map(({ dept, pos }) => (
            <line
              key={`link-${dept.key}`}
              className={`bc-eco-link${activeDeptKey === dept.key ? " bc-eco-link-active" : ""}`}
              x1={CENTER.x}
              y1={CENTER.y}
              x2={pos.x}
              y2={pos.y}
              stroke={activeDeptKey === dept.key ? sectorNodes.find((s) => s.dept.key === dept.key)?.color : undefined}
              filter={activeDeptKey === dept.key ? "url(#eco-blur-tight)" : undefined}
            />
          ))}

          {activeSector &&
            leaves.map((leaf, i) => (
              <line key={`leaf-link-${i}`} className="bc-eco-link bc-eco-link-active" stroke={activeSector.color} x1={activeSector.pos.x} y1={activeSector.pos.y} x2={leaf.x} y2={leaf.y} />
            ))}

          <g className="bc-eco-node-core" transform={`translate(${CENTER.x}, ${CENTER.y})`}>
            <circle r={34} fill="var(--bc-amber)" opacity={0.16} filter="url(#eco-blur-soft)" />
            <circle r={30} fill="#0b0b0b" stroke="var(--bc-amber)" strokeWidth={1.5} />
            <circle r={4} fill="var(--bc-amber)" />
            <text className="bc-eco-label-core" y={48} textAnchor="middle" fontSize={13}>
              Jarvis
            </text>
          </g>

          {sectorNodes.map(({ dept, pos, color, icon }) => {
            const isActive = activeDeptKey === dept.key;
            return (
              <g key={dept.key} className="bc-eco-node-sector" transform={`translate(${pos.x}, ${pos.y})`} onClick={() => setActiveDeptKey(isActive ? null : dept.key)}>
                {isActive && <circle className="bc-eco-pulse" r={30} fill={color} opacity={0.28} filter="url(#eco-blur-soft)" />}
                <circle r={22} fill={isActive ? color : "#0b0b0b"} fillOpacity={isActive ? 0.16 : 1} stroke={color} strokeWidth={1.5} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={14} fill={color}>
                  {icon}
                </text>
                <text className="bc-eco-label" y={40} textAnchor="middle" fontSize={10.5}>
                  {dept.name}
                </text>
              </g>
            );
          })}

          {activeSector && activeAgents.length === 0 && leaves[0] && (
            <g transform={`translate(${leaves[0].x}, ${leaves[0].y})`}>
              <rect x={-16} y={-16} width={32} height={32} rx={9} fill="var(--bc-surface-2)" stroke="var(--bc-border)" strokeDasharray="3 3" />
              <text className="bc-eco-label" y={30} textAnchor="middle" fontSize={9.5}>
                Aucun agent
              </text>
            </g>
          )}

          {activeSector &&
            activeAgents.map((agent, i) => {
              const pos = leaves[i];
              return (
                <g
                  key={agent.key}
                  className="bc-eco-node-leaf"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openAgent(agent);
                  }}
                >
                  <circle r={20} fill="var(--bc-amber)" opacity={0.18} filter="url(#eco-blur-tight)" />
                  <circle r={17} fill="var(--bc-surface-2)" stroke="var(--bc-amber-dim)" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--bc-amber)" fontFamily="var(--font-jbmono)">
                    {agentGlyph(agent.type)}
                  </text>
                  <text className="bc-eco-label" y={32} textAnchor="middle" fontSize={9.5}>
                    {agent.name}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {activeAgent &&
        (() => {
          const agentCapabilities = graph.capabilities.filter((c) => c.agentKey === activeAgent.key);
          const agentToolKeys = new Set(agentCapabilities.flatMap((c) => c.toolKeys));
          return (
            <AgentPanel
              agent={activeAgent}
              department={graph.departments.find((d) => d.key === activeAgent.departmentKey) ?? null}
              capabilities={agentCapabilities}
              tools={graph.tools.filter((t) => agentToolKeys.has(t.key))}
              onClose={() => setActiveAgent(null)}
            />
          );
        })()}
    </>
  );
}

function hexPoints(size: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${(size * Math.cos(angle)).toFixed(1)},${(size * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}
