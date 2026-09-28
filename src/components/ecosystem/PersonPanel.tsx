"use client";

import { useState } from "react";
import { sectorById, type EcosystemPerson, type EcosystemTool } from "@/lib/ecosystem-mock-data";

export function PersonPanel({ person, onClose }: { person: EcosystemPerson; onClose: () => void }) {
  const [tools, setTools] = useState<EcosystemTool[]>(person.tools);
  const sector = sectorById(person.sectorId);
  const granted = tools.filter((t) => t.access);
  const revoked = tools.filter((t) => !t.access);

  function toggle(id: string) {
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, access: !t.access } : t)));
  }

  return (
    <>
      <div className="bc-eco-panel-backdrop" onClick={onClose} />
      <div className="bc-eco-panel">
        <button type="button" className="bc-eco-panel-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <div className="bc-eco-panel-avatar">{person.initial}</div>
        <div className="bc-eco-panel-name">{person.name}</div>
        <div className="bc-eco-panel-role">
          {person.role} · {sector?.name ?? "—"}
        </div>

        <div className="bc-eco-panel-meta">
          <div>
            <div className="n">{tools.length}</div>
            <div className="lab">Outils</div>
          </div>
          <div>
            <div className="n">{granted.length}</div>
            <div className="lab">Accès actifs</div>
          </div>
          <div>
            <div className="n">{person.since}</div>
            <div className="lab">Dans l&apos;équipe</div>
          </div>
        </div>

        <div className="bc-nav-label" style={{ padding: 0, margin: "0 0 8px" }}>
          A accès
        </div>
        {granted.length === 0 && (
          <p style={{ color: "var(--bc-text-faint)", fontSize: 12, fontStyle: "italic" }}>Aucun accès accordé.</p>
        )}
        {granted.map((tool) => (
          <ToolRow key={tool.id} tool={tool} onToggle={() => toggle(tool.id)} />
        ))}

        <div className="bc-nav-label" style={{ padding: 0, margin: "18px 0 8px" }}>
          À accorder
        </div>
        {revoked.length === 0 && (
          <p style={{ color: "var(--bc-text-faint)", fontSize: 12, fontStyle: "italic" }}>Tous les outils sont accordés.</p>
        )}
        {revoked.map((tool) => (
          <ToolRow key={tool.id} tool={tool} onToggle={() => toggle(tool.id)} />
        ))}
      </div>
    </>
  );
}

function ToolRow({ tool, onToggle }: { tool: EcosystemTool; onToggle: () => void }) {
  return (
    <div className="bc-eco-tool-row">
      <div className="bc-eco-tool-icon">{tool.icon}</div>
      <span style={{ fontSize: 13, color: "var(--bc-text)" }}>{tool.name}</span>
      <button
        type="button"
        className={`bc-eco-toggle${tool.access ? " on" : ""}`}
        onClick={onToggle}
        aria-pressed={tool.access}
        aria-label={`${tool.access ? "Révoquer" : "Accorder"} l'accès à ${tool.name}`}
      />
    </div>
  );
}
