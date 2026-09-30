-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "EditingBatch" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "assignedEditorId" TEXT,
    "status" "VideoStage" NOT NULL DEFAULT 'A_EDITER',
    "note" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditingBatch_agencyId_idx" ON "EditingBatch"("agencyId");

-- CreateIndex
CREATE INDEX "EditingBatch_assignedEditorId_idx" ON "EditingBatch"("assignedEditorId");

-- CreateIndex
CREATE INDEX "EditingBatch_status_idx" ON "EditingBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EditingBatch_modelId_weekLabel_assignedEditorId_key" ON "EditingBatch"("modelId", "weekLabel", "assignedEditorId");

-- CreateIndex
CREATE INDEX "Video_batchId_idx" ON "Video"("batchId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "EditingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditingBatch" ADD CONSTRAINT "EditingBatch_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditingBatch" ADD CONSTRAINT "EditingBatch_assignedEditorId_fkey" FOREIGN KEY ("assignedEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditingBatch" ADD CONSTRAINT "EditingBatch_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
