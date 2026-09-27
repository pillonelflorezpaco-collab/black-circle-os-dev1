-- Add Team.agencyId: nullable first, backfill every existing Team into one
-- default Agency (the pre-existing single-agency data), then require it.
-- Two-step nullable->required pattern, safe against a live table with rows.

ALTER TABLE "Team" ADD COLUMN "agencyId" TEXT;

INSERT INTO "Agency" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('default-agency-black-circle', 'Black Circle', 'black-circle', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

UPDATE "Team" SET "agencyId" = 'default-agency-black-circle' WHERE "agencyId" IS NULL;

ALTER TABLE "Team" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "Team" ADD CONSTRAINT "Team_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Team_agencyId_idx" ON "Team"("agencyId");
