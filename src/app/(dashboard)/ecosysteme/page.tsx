import { EcosystemGraph } from "@/components/ecosystem/EcosystemGraph";

export default function EcosystemePage() {
  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Écosystème</span> Black Circle
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Prototype visuel — données mockées
        </div>
      </div>

      <p style={{ color: "var(--bc-text-faint)", fontSize: 12.5, marginBottom: 18, maxWidth: 620 }}>
        Clique un secteur pour révéler ses agents (workflows n8n) et ses personnes, puis clique une personne pour voir
        et gérer ses accès aux outils connectés.
      </p>

      <EcosystemGraph />
    </>
  );
}
