import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getBlackosWorldSnapshot } from "@/services/blackosWorld.service";
import { WorldMap } from "@/components/blackos/World/WorldMap";

export default async function BlackosWorldPage() {
  const agencyId = await getEffectiveAgencyId();
  const snapshot = await getBlackosWorldSnapshot(agencyId);

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">BlackOS</span> World
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Read-only — observes the system, decides nothing
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--bc-text-faint)", marginBottom: 20, maxWidth: 680 }}>
        Click Jarvis, a Department, a Software Agent, a Task, the Approval Gate, an Execution, or a Tool to see what it
        really is, its current state, and what it connects to. This is the real current system state — not a mockup.
      </p>

      <WorldMap snapshot={snapshot} />
    </>
  );
}
