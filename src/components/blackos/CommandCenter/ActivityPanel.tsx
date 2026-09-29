import type { Event } from "@prisma/client";

const EVENT_LABELS: Record<string, string> = {
  TASK_CREATED: "Tâche créée",
  TASK_APPROVAL_REQUESTED: "Approbation demandée",
  TASK_APPROVED: "Tâche approuvée",
  TASK_REJECTED: "Tâche rejetée",
  DEVICE_CONNECTED: "Appareil connecté",
  DEVICE_DISCONNECTED: "Appareil déconnecté",
  ACCOUNT_CONNECTED: "Compte connecté",
  ACCOUNT_DISCONNECTED: "Compte déconnecté",
  AGENT_ENABLED: "Agent activé",
  AGENT_DISABLED: "Agent désactivé",
  WORKFLOW_STARTED: "Workflow démarré",
  WORKFLOW_COMPLETED: "Workflow terminé",
  WORKFLOW_FAILED: "Workflow échoué",
};

export function ActivityPanel({ events, error }: { events: Event[] | null; error?: string }) {
  return (
    <div className="bc-card">
      <div className="bc-section-title">
        <div className="st-left">
          <span className="eyebrow">Système</span>Événements récents
        </div>
      </div>

      {error ? (
        <p className="bc-empty-state error">{error}</p>
      ) : events === null ? (
        <p className="bc-empty-state">Chargement…</p>
      ) : events.length === 0 ? (
        <p className="bc-empty-state">Aucun événement pour le moment.</p>
      ) : (
        events.map((event) => (
          <div key={event.id} className="bc-watch-row">
            <div className="bc-watch-left">
              <div className="bc-watch-icon dot-ok">•</div>
              <div>
                <div className="bc-watch-name">{EVENT_LABELS[event.type] ?? event.type}</div>
                {event.message && <div className="bc-watch-sub">{event.message}</div>}
              </div>
            </div>
            <div className="bc-watch-right">
              <div className="bc-watch-amt">{new Date(event.createdAt).toLocaleString("fr-FR")}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
