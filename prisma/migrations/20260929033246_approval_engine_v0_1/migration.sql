-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemEventType" ADD VALUE 'TASK_APPROVAL_REQUESTED';
ALTER TYPE "SystemEventType" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "SystemEventType" ADD VALUE 'TASK_REJECTED';

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "riskLevel" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "reason" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Approval_agencyId_idx" ON "Approval"("agencyId");

-- CreateIndex
CREATE INDEX "Approval_taskId_idx" ON "Approval"("taskId");

-- CreateIndex
CREATE INDEX "Approval_status_idx" ON "Approval"("status");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One active PENDING approval per task (Approval Engine v0.1 idempotency
-- guarantee -- enforced at the database level, not app-only check-then-insert).
-- Prisma's schema language has no native partial-unique-index syntax, so
-- this is a hand-added statement.
CREATE UNIQUE INDEX "Approval_task_pending_unique" ON "Approval"("taskId") WHERE status = 'PENDING';
