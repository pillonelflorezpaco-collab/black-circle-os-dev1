import "dotenv/config";
import { getBoss } from "./boss";
import { registerHeartbeatJob } from "./jobs/heartbeat.job";

/**
 * Entrypoint for the `worker` container (docker-compose.yml). Starts pg-boss
 * and registers every job this engine currently owns. The `app` container
 * never runs this file — it only enqueues jobs via getBoss().send()/schedule().
 */
async function main() {
  const boss = getBoss();
  await boss.start();
  await registerHeartbeatJob(boss);
  console.log("[social-engine:worker] started");
}

main().catch((err) => {
  console.error("[social-engine:worker] fatal", err);
  process.exit(1);
});
