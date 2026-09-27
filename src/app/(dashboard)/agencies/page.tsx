import { listAgencies } from "@/services/agency.service";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import AgencyForm from "./AgencyForm";
import AgencyStatusToggle from "./AgencyStatusToggle";

export default async function AgenciesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const canManage = can(session.user.role, "gererAgences");
  const agencies = await listAgencies(session.user.role);

  return (
    <>
      <div className="bc-topbar">
        <h2>Agences</h2>
        <div className="bc-status">
          <span className="dot" />
          {agencies.length} agences
        </div>
      </div>

      {canManage && <AgencyForm />}

      <div className="bc-grid4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {agencies.map((a) => (
          <div key={a.id} className="bc-team-card">
            <div className="bc-tc-top">
              <div className="bc-tc-avatar">{a.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="bc-tc-name">{a.name}</div>
                <div className="bc-tc-role">{a.slug}</div>
              </div>
            </div>
            <div className="bc-tc-row">
              <span>Models</span>
              <span style={{ fontFamily: "var(--font-jbmono)", color: "var(--bc-text)" }}>{a.modelsCount}</span>
            </div>
            <div className="bc-tc-row">
              <span>Équipe</span>
              <span style={{ fontFamily: "var(--font-jbmono)", color: "var(--bc-text)" }}>{a.usersCount}</span>
            </div>
            <div className="bc-tc-row">
              <span>Teams</span>
              <span style={{ fontFamily: "var(--font-jbmono)", color: "var(--bc-text)" }}>{a.teamsCount}</span>
            </div>
            {canManage && (
              <div className="bc-tc-row" style={{ borderTop: "1px solid var(--bc-border)", paddingTop: 10, marginTop: 2 }}>
                <AgencyStatusToggle id={a.id} status={a.status} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
