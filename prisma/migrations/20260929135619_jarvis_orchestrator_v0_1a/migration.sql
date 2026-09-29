-- CreateEnum
CREATE TYPE "OrchestrationState" AS ENUM ('REQUESTED', 'PLANNING', 'TASK_CREATED', 'AWAITING_APPROVAL', 'EXECUTING', 'COMPLETED', 'FAILED', 'NEEDS_CLARIFICATION', 'REJECTED');

-- CreateTable
CREATE TABLE "OrchestrationRecord" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "requestId" TEXT,
    "state" "OrchestrationState" NOT NULL DEFAULT 'REQUESTED',
    "failureReason" TEXT,
    "taskId" TEXT,
    "approvalId" TEXT,
    "executionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrchestrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrchestrationRecord_agencyId_idx" ON "OrchestrationRecord"("agencyId");

-- CreateIndex
CREATE INDEX "OrchestrationRecord_taskId_idx" ON "OrchestrationRecord"("taskId");

-- CreateIndex
CREATE INDEX "OrchestrationRecord_approvalId_idx" ON "OrchestrationRecord"("approvalId");

-- CreateIndex
CREATE INDEX "OrchestrationRecord_executionId_idx" ON "OrchestrationRecord"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestrationRecord_agencyId_requestId_key" ON "OrchestrationRecord"("agencyId", "requestId");
