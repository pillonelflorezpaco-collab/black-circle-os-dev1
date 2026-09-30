-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "weekLabel" TEXT;

-- CreateIndex
CREATE INDEX "Video_driveFileId_idx" ON "Video"("driveFileId");
