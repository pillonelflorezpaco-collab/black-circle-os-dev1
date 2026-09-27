-- Multi-agency foundation: Agency tenant model + Team.agencyId (nullable for
-- now — backfilled below, then a follow-up migration flips it to NOT NULL).
-- Also expands Role from 5 to 14 values (renaming the 3 that map cleanly onto
-- the new taxonomy, adding the rest, keeping the unused VIEWER value as-is
-- since Postgres has no cheap DROP VALUE for enums).

-- AgencyStatus enum + Agency table
CREATE TYPE "AgencyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AgencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");
CREATE INDEX "Agency_slug_idx" ON "Agency"("slug");

-- Role enum: rename the 3 that map cleanly, add the rest
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';
ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'AGENCY_MANAGER';
ALTER TYPE "Role" RENAME VALUE 'MONTEUR' TO 'VIDEO_EDITOR';
ALTER TYPE "Role" ADD VALUE 'OWNER';
ALTER TYPE "Role" ADD VALUE 'CLOSER';
ALTER TYPE "Role" ADD VALUE 'SALES';
ALTER TYPE "Role" ADD VALUE 'CHATTER_MANAGER';
ALTER TYPE "Role" ADD VALUE 'CHATTER';
ALTER TYPE "Role" ADD VALUE 'CONTENT_MANAGER';
ALTER TYPE "Role" ADD VALUE 'EDITOR';
ALTER TYPE "Role" ADD VALUE 'MODEL_ROLE';
ALTER TYPE "Role" ADD VALUE 'FINANCE';
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';

-- New user default: ASSISTANT (lowest-privilege real role) instead of VIEWER
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ASSISTANT';
