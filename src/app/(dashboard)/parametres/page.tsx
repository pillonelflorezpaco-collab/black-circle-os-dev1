import { PERMISSIONS, can } from "@/lib/permissions";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["ADMIN", "MANAGER", "ASSISTANT", "MONTEUR", "VIEWER"];

const PERMISSION_LABELS: Record<string, string> = {
  voirClients: "Voir les clients",
  editerPipeline: "Éditer le pipeline",
  validerVideos: "Valider les vidéos",
  publier: "Publier",
  gererEquipe: "Gérer l'équipe",
  facturation: "Facturation",
  automatisations: "Automatisations",
};

export default function ParametresPage() {
  return (
    <>
      <div className="bc-topbar">
        <h2>Paramètres</h2>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Compte</span>Profil
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 22 }}>
        <div className="bc-form-grid">
          <div>
            <label>Nom complet</label>
            <input defaultValue="Angels Pillonel" readOnly />
          </div>
          <div>
            <label>Email</label>
            <input defaultValue="pillonelflorezpaco@gmail.com" readOnly />
          </div>
          <div>
            <label>Fuseau horaire</label>
            <select defaultValue="utc-4">
              <option value="utc-4">UTC-04:00 — Santo Domingo</option>
            </select>
          </div>
          <div>
            <label>Langue</label>
            <select defaultValue="fr">
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Accès</span>Rôles &amp; permissions
        </div>
      </div>
      <div className="bc-card" style={{ marginBottom: 22, overflowX: "auto" }}>
        <table className="bc-perm-table">
          <thead>
            <tr>
              <th>Permission</th>
              {ROLES.map((r) => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm) => (
              <tr key={perm}>
                <td>{PERMISSION_LABELS[perm]}</td>
                {ROLES.map((r) => (
                  <td key={r}>{can(r, perm) ? <span className="bc-perm-yes">✓</span> : <span className="bc-perm-no">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Intégrations</span>Raccourci
        </div>
      </div>
      <div className="bc-card">
        <div className="bc-watch-row">
          <div className="bc-watch-left">
            <div className="bc-watch-icon">⚙</div>
            <div>
              <div className="bc-watch-name">Gérer les connexions API</div>
              <div className="bc-watch-sub">Blotato, n8n, Google Drive, Telegram, Google Calendar…</div>
            </div>
          </div>
          <div className="bc-watch-right">
            <a
              href="/automatisations"
              style={{
                background: "var(--bc-surface)",
                color: "var(--bc-text-dim)",
                border: "1px solid var(--bc-border)",
                fontWeight: 600,
                fontSize: 12.5,
                padding: "9px 16px",
                borderRadius: 9,
                textDecoration: "none",
              }}
            >
              Ouvrir Automatisations →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
