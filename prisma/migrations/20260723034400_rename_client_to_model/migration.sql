-- Rename Client -> Model (pure rename, zero data loss).
-- Prisma's diff engine cannot auto-detect renames in non-interactive mode,
-- so this migration is hand-written using RENAME statements instead of the
-- DROP+CREATE it would otherwise generate.

-- Enum
ALTER TYPE "ClientStatus" RENAME TO "ModelStatus";

-- Table
ALTER TABLE "Client" RENAME TO "Model";
ALTER TABLE "Model" RENAME CONSTRAINT "Client_pkey" TO "Model_pkey";
ALTER INDEX "Client_accessCode_key" RENAME TO "Model_accessCode_key";
ALTER INDEX "Client_blotatoAccountId_idx" RENAME TO "Model_blotatoAccountId_idx";
ALTER INDEX "Client_teamId_idx" RENAME TO "Model_teamId_idx";
ALTER TABLE "Model" RENAME CONSTRAINT "Client_teamId_fkey" TO "Model_teamId_fkey";
ALTER TABLE "Model" RENAME CONSTRAINT "Client_blotatoAccountId_fkey" TO "Model_blotatoAccountId_fkey";

-- SocialAccount.clientId -> modelId
ALTER TABLE "SocialAccount" RENAME COLUMN "clientId" TO "modelId";
ALTER TABLE "SocialAccount" RENAME CONSTRAINT "SocialAccount_clientId_fkey" TO "SocialAccount_modelId_fkey";
ALTER INDEX "SocialAccount_clientId_platform_key" RENAME TO "SocialAccount_modelId_platform_key";

-- Video.clientId -> modelId
ALTER TABLE "Video" RENAME COLUMN "clientId" TO "modelId";
ALTER TABLE "Video" RENAME CONSTRAINT "Video_clientId_fkey" TO "Video_modelId_fkey";
ALTER INDEX "Video_clientId_stage_idx" RENAME TO "Video_modelId_stage_idx";

-- ActivityLogEntry.clientId -> modelId
ALTER TABLE "ActivityLogEntry" RENAME COLUMN "clientId" TO "modelId";
ALTER TABLE "ActivityLogEntry" RENAME CONSTRAINT "ActivityLogEntry_clientId_fkey" TO "ActivityLogEntry_modelId_fkey";
ALTER INDEX "ActivityLogEntry_clientId_createdAt_idx" RENAME TO "ActivityLogEntry_modelId_createdAt_idx";
