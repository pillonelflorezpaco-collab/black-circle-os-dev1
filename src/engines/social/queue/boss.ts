import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { socialEngineBoss: PgBoss | undefined };

/**
 * Singleton pg-boss instance for the Social Engine — job queue on top of the
 * existing Postgres (see docs/ or the Social Engine plan for why: no Redis
 * to provision/monitor on the VPS). Started once from queue/worker.ts (the
 * `worker` container); the `app` container only enqueues via boss.send()/
 * boss.schedule(), it never calls start() itself.
 */
export function getBoss(): PgBoss {
  if (!globalForBoss.socialEngineBoss) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set — required for pg-boss.");
    globalForBoss.socialEngineBoss = new PgBoss({ connectionString });
    globalForBoss.socialEngineBoss.on("error", (err) => console.error("[social-engine:boss]", err));
  }
  return globalForBoss.socialEngineBoss;
}

// Extended with publishPost/refreshToken/pollPostStatus/syncAnalytics in later phases.
// pg-boss queue names may only contain alphanumerics, underscores, hyphens, periods, or slashes (no colons).
export const QUEUES = {
  heartbeat: "social-engine.heartbeat",
} as const;
