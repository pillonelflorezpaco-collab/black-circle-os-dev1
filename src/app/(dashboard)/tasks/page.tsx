import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { getRecentTasks } from "@/services/commandCenter.service";
import { TaskPanel } from "@/components/blackos/CommandCenter/TaskPanel";

export default async function TasksPage() {
  const agencyId = await getEffectiveAgencyId();
  const tasks = await getRecentTasks(agencyId, 50);

  const planned = tasks.filter((t) => t.status === "PLANNED").length;
  const waiting = tasks.filter((t) => t.status === "WAITING_APPROVAL").length;
  const ready = tasks.filter((t) => t.status === "READY").length;

  return (
    <>
      <div className="bc-topbar">
        <h2>
          <span className="accent">Tasks</span>
        </h2>
        <div className="bc-status">
          <span className="dot" />
          Task Engine v0.1
        </div>
      </div>

      <div className="bc-page-summary">
        <span className="bc-page-summary-stat">
          <b>{tasks.length}</b> total
        </span>
        {planned > 0 && (
          <span className="bc-page-summary-stat">
            <b>{planned}</b> planned
          </span>
        )}
        {waiting > 0 && (
          <span className="bc-page-summary-stat">
            <b>{waiting}</b> waiting on approval
          </span>
        )}
        {ready > 0 && (
          <span className="bc-page-summary-stat">
            <b>{ready}</b> ready
          </span>
        )}
      </div>

      <TaskPanel tasks={tasks} />
    </>
  );
}
