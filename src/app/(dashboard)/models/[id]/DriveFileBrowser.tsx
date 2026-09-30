"use client";

import { useState, useTransition } from "react";
import { listModelDriveFolderAction } from "./actions";
import type { DriveEntry } from "@/lib/googleDrive";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Root {
  label: string;
  folderId: string;
}

export default function DriveFileBrowser({ modelId, roots }: { modelId: string; roots: Root[] }) {
  const [activeRootIndex, setActiveRootIndex] = useState(0);
  // Breadcrumb stack: [{ id, name }] — the root itself is always path[0].
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: roots[0]?.folderId ?? "", name: roots[0]?.label ?? "" }]);
  const [entries, setEntries] = useState<DriveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadFolder(folderId: string) {
    setError(null);
    startTransition(async () => {
      const result = await listModelDriveFolderAction(modelId, folderId);
      if (result === null) {
        setError("Impossible de charger ce dossier.");
        setEntries(null);
      } else {
        setEntries(result);
      }
    });
  }

  function openRoot(index: number) {
    setActiveRootIndex(index);
    const root = roots[index];
    setPath([{ id: root.folderId, name: root.label }]);
    loadFolder(root.folderId);
  }

  function openFolder(entry: DriveEntry) {
    setPath((prev) => [...prev, { id: entry.id, name: entry.name }]);
    loadFolder(entry.id);
  }

  function goToBreadcrumb(index: number) {
    setPath((prev) => prev.slice(0, index + 1));
    loadFolder(path[index].id);
  }

  if (roots.length === 0) return <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Aucun dossier Drive lié à ce modèle.</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {roots.map((root, i) => (
          <button
            key={root.folderId}
            type="button"
            onClick={() => openRoot(i)}
            className="bc-plat-chip"
            style={{ background: i === activeRootIndex && entries !== null ? "var(--bc-amber-glow)" : undefined, cursor: "pointer" }}
          >
            {root.label}
          </button>
        ))}
      </div>

      {entries === null && !isPending && !error && (
        <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Cliquez sur un dossier ci-dessus pour parcourir son contenu réel.</p>
      )}

      {entries !== null && (
        <div style={{ fontSize: 11.5, color: "var(--bc-text-faint)", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {path.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " / "}
              <button type="button" onClick={() => goToBreadcrumb(i)} style={{ background: "none", border: "none", color: i === path.length - 1 ? "var(--bc-text-dim)" : "var(--bc-amber)", cursor: "pointer", fontSize: 11.5, padding: 0 }}>
                {p.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {isPending && <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Chargement…</p>}
      {error && <p style={{ color: "var(--bc-red)", fontSize: 12.5 }}>{error}</p>}

      {entries !== null && !isPending && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {entries.length === 0 ? (
            <p style={{ color: "var(--bc-text-faint)", fontStyle: "italic", fontSize: 13 }}>Dossier vide.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => (entry.isFolder ? openFolder(entry) : window.open(entry.webViewLink ?? undefined, "_blank"))}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 4px", borderBottom: "1px solid var(--bc-border)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span>{entry.isFolder ? "📁" : "📄"}</span>
                  <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                </div>
                <div style={{ display: "flex", gap: 10, flexShrink: 0, fontSize: 11, color: "var(--bc-text-faint)" }}>
                  {!entry.isFolder && entry.sizeBytes !== null && <span>{formatSize(entry.sizeBytes)}</span>}
                  {entry.modifiedTime && <span>{new Date(entry.modifiedTime).toLocaleDateString("fr-FR")}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
