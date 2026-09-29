import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getRecentEvents } from "@/services/commandCenter.service";
import { ActivityPanel } from "@/components/blackos/CommandCenter/ActivityPanel";

export default async function EventsPage() {
  const agencyId = await getEffectiveAgencyId();
  const events = await getRecentEvents(agencyId, 50);

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Events</span>
        </h2>
        <div className="bc-status">
          <span className="dot" />
          System log
        </div>
      </div>

      <div className="bc-page-summary">
        <span className="bc-page-summary-stat">
          <b>{events.length}</b> recorded
        </span>
      </div>

      <ActivityPanel events={events} />
    </>
  );
}
