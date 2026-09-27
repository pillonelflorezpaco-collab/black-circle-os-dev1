-- DropIndex
DROP INDEX "Report_agencyId_idx";

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "ModelLink" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelAssignment" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelLink_modelId_idx" ON "ModelLink"("modelId");

-- CreateIndex
CREATE INDEX "ModelAssignment_modelId_idx" ON "ModelAssignment"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelAssignment_modelId_userId_key" ON "ModelAssignment"("modelId", "userId");

-- AddForeignKey
ALTER TABLE "ModelLink" ADD CONSTRAINT "ModelLink_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAssignment" ADD CONSTRAINT "ModelAssignment_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAssignment" ADD CONSTRAINT "ModelAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
