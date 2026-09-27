-- CreateEnum
CREATE TYPE "SocialAccountSource" AS ENUM ('BLOTATO', 'NATIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'PLATFORM_CONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PLATFORM_DISCONNECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PLATFORM_TOKEN_EXPIRED';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'SOCIAL_ENGINE_NATIVE';

-- DropForeignKey
ALTER TABLE "SocialAccount" DROP CONSTRAINT "SocialAccount_blotatoAccountId_fkey";

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "platformConnectionId" TEXT,
ADD COLUMN     "source" "SocialAccountSource" NOT NULL DEFAULT 'BLOTATO',
ALTER COLUMN "blotatoAccountId" DROP NOT NULL,
ALTER COLUMN "blotatoAccountRef" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "videoId" TEXT,
    "agencyId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineApiKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "agencyId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformConnection_agencyId_idx" ON "PlatformConnection"("agencyId");

-- CreateIndex
CREATE INDEX "PlatformConnection_tokenExpiresAt_idx" ON "PlatformConnection"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConnection_modelId_platform_key" ON "PlatformConnection"("modelId", "platform");

-- CreateIndex
CREATE INDEX "MediaAsset_videoId_idx" ON "MediaAsset"("videoId");

-- CreateIndex
CREATE INDEX "MediaAsset_agencyId_idx" ON "MediaAsset"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "EngineApiKey_hashedKey_key" ON "EngineApiKey"("hashedKey");

-- CreateIndex
CREATE INDEX "EngineApiKey_agencyId_idx" ON "EngineApiKey"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platformConnectionId_key" ON "SocialAccount"("platformConnectionId");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_blotatoAccountId_fkey" FOREIGN KEY ("blotatoAccountId") REFERENCES "BlotatoAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_platformConnectionId_fkey" FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineApiKey" ADD CONSTRAINT "EngineApiKey_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

