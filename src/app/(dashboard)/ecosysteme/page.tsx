import { EcosystemGraph } from "@/components/ecosystem/EcosystemGraph";
import { getOrganizationGraph } from "@/services/organization.service";

export default async function EcosystemePage() {
  let graph = null;
  let error: string | undefined;
  try {
    graph = await getOrganizationGraph();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de contacter Neo4j.";
  }

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Écosystème</span> Black Circle
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Graphe organisationnel réel (Neo4j)
        </div>
      </div>

      <p style={{ color: "var(--bc-text-faint)", fontSize: 12.5, marginBottom: 18, maxWidth: 620 }}>
        Clique un département pour révéler ses agents, puis clique un agent pour voir ses capacités et les outils
        associés.
      </p>

      {error ? (
        <div className="bc-card">
          <p className="bc-empty-state error">Le graphe organisationnel est indisponible : {error}</p>
        </div>
      ) : !graph || graph.departments.length === 0 ? (
        <div className="bc-card">
          <p className="bc-empty-state">Aucun département dans le graphe organisationnel pour le moment.</p>
        </div>
      ) : (
        <EcosystemGraph graph={graph} />
      )}
    </>
  );
}
