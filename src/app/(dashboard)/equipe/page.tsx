import { listTeamMembers } from "@/services/team.service";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import TeamMemberForm from "./TeamMemberForm";
import TeamMemberActions from "./TeamMemberActions";

export default async function EquipePage() {
  const [team, session] = await Promise.all([listTeamMembers(), auth()]);
  const canManage = !!session?.user && can(session.user.role, "gererEquipe");

  return (
    <>
      <div className="bc-topbar">
        <h2>Équipe</h2>
      </div>

      {canManage && <TeamMemberForm />}

      <div className="bc-grid4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {team.map((t) => {
          const color = t.load > 80 ? "var(--bc-red)" : t.load > 60 ? "var(--bc-amber)" : "var(--bc-green)";
          return (
            <div key={t.id} className="bc-team-card">
              <div className="bc-tc-top">
                <div className="bc-tc-avatar">{t.initials}</div>
                <div>
                  <div className="bc-tc-name">{t.name}</div>
                  <div className="bc-tc-role">{t.roleLabel}</div>
                </div>
              </div>
              <div className="bc-tc-row">
                <span>Vidéos en cours</span>
                <span style={{ fontFamily: "var(--font-jbmono)", color: "var(--bc-text)" }}>{t.videosInProgress}</span>
              </div>
              <div>
                <div className="bc-tc-row">
                  <span>Charge de travail</span>
                  <span style={{ fontFamily: "var(--font-jbmono)", color }}>{t.load}%</span>
                </div>
                <div className="bc-tc-bar-track" style={{ marginTop: 5 }}>
                  <div className="bc-tc-bar-fill" style={{ width: `${t.load}%`, background: color }} />
                </div>
              </div>
              <div className="bc-tc-row">Actif {new Date(t.updatedAt).toLocaleDateString("fr-FR")}</div>
              {canManage && (
                <div className="bc-tc-row" style={{ borderTop: "1px solid var(--bc-border)", paddingTop: 10, marginTop: 2 }}>
                  <TeamMemberActions userId={t.id} role={t.role} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
