import { PgBoss } from "pg-boss";
import { QUEUES } from "../boss";
import { syncDriveContentForAllModels } from "@/services/driveSync.service";

/**
 * Daily scan of every model's Drive folder for new uploaded files — see
 * src/services/driveSync.service.ts for what it does. Runs at 06:00 server
 * time so overnight uploads are picked up before the editor's day starts.
 */
export async function registerDriveSyncJob(boss: PgBoss) {
  await boss.createQueue(QUEUES.driveSync);
  await boss.schedule(QUEUES.driveSync, "0 6 * * *");
  await boss.work(QUEUES.driveSync, async () => {
    const result = await syncDriveContentForAllModels();
    console.log(`[social-engine:driveSync] scanned ${result.modelsScanned} models, moved ${result.filesMoved} files, imported ${result.videosCreated} new videos`);
  });
}
