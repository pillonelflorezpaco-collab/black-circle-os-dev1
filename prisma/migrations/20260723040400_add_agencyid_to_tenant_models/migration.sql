-- Add agencyId to every remaining tenant-scoped model, backfilled to the
-- same default agency created in the previous migration. Nullable->backfill->
-- required for every table except User (stays nullable: NULL means Super
-- Admin, not scoped to a single agency). Also promotes the one seeded ADMIN
-- (now SUPER_ADMIN) user to agencyId = NULL, and updates Integration's
-- uniqueness to be per-agency instead of global.

-- User.agencyId (nullable, no NOT NULL flip — NULL = Super Admin)
ALTER TABLE "User" ADD COLUMN "agencyId" TEXT;
UPDATE "User" SET "agencyId" = 'default-agency-black-circle' WHERE "role" != 'SUPER_ADMIN';
-- SUPER_ADMIN rows keep agencyId = NULL (no update needed, column defaults to NULL).
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- Model.agencyId
ALTER TABLE "Model" ADD COLUMN "agencyId" TEXT;
UPDATE "Model" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "Model" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Model" ADD CONSTRAINT "Model_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Model_agencyId_idx" ON "Model"("agencyId");

-- Video.agencyId
ALTER TABLE "Video" ADD COLUMN "agencyId" TEXT;
UPDATE "Video" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "Video" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Video" ADD CONSTRAINT "Video_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Video_agencyId_idx" ON "Video"("agencyId");

-- Post.agencyId
ALTER TABLE "Post" ADD COLUMN "agencyId" TEXT;
UPDATE "Post" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "Post" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Post" ADD CONSTRAINT "Post_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Post_agencyId_idx" ON "Post"("agencyId");

-- ActivityLogEntry.agencyId
ALTER TABLE "ActivityLogEntry" ADD COLUMN "agencyId" TEXT;
UPDATE "ActivityLogEntry" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "ActivityLogEntry" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ActivityLogEntry_agencyId_idx" ON "ActivityLogEntry"("agencyId");

-- Report.agencyId
ALTER TABLE "Report" ADD COLUMN "agencyId" TEXT;
UPDATE "Report" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "Report" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Report_agencyId_idx" ON "Report"("agencyId");

-- Integration.agencyId + per-agency uniqueness instead of global
ALTER TABLE "Integration" ADD COLUMN "agencyId" TEXT;
UPDATE "Integration" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "Integration" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "Integration_type_key";
CREATE UNIQUE INDEX "Integration_agencyId_type_key" ON "Integration"("agencyId", "type");

-- BlotatoAccount.agencyId
ALTER TABLE "BlotatoAccount" ADD COLUMN "agencyId" TEXT;
UPDATE "BlotatoAccount" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;
ALTER TABLE "BlotatoAccount" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "BlotatoAccount" ADD CONSTRAINT "BlotatoAccount_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "BlotatoAccount_agencyId_idx" ON "BlotatoAccount"("agencyId");
