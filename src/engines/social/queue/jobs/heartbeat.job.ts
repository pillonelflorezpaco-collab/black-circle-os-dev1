import { PgBoss } from "pg-boss";
import { QUEUES } from "../boss";

/**
 * Throwaway verification job for Phase 0 — proves the worker container is
 * alive and wired to Postgres correctly. Safe to delete once Phase 1's real
 * jobs (publishPost, refreshToken, ...) are running and logging their own
 * activity.
 */
export async function registerHeartbeatJob(boss: PgBoss) {
  await boss.createQueue(QUEUES.heartbeat);
  await boss.schedule(QUEUES.heartbeat, "*/5 * * * *");
  await boss.work(QUEUES.heartbeat, async () => {
    console.log(`[social-engine:heartbeat] alive at ${new Date().toISOString()}`);
  });
}
