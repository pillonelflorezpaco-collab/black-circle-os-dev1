-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PLANNED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('JARVIS', 'HUMAN', 'SYSTEM');

-- AlterEnum
ALTER TYPE "SystemEventType" ADD VALUE 'TASK_CREATED';

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "source" "TaskSource" NOT NULL,
    "agentKey" TEXT,
    "capabilityKey" TEXT,
    "departmentKey" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "riskLevel" TEXT,
    "executionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "parentTaskId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_agencyId_status_idx" ON "Task"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_entityType_entityId_idx" ON "Task"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_agencyId_requestId_key" ON "Task"("agencyId", "requestId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
