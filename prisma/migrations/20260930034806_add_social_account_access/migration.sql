-- DropIndex
DROP INDEX "SocialAccount_modelId_platform_key";

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "isMotherAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loginIdentifier" TEXT,
ADD COLUMN     "loginPasswordEnc" TEXT;

-- CreateIndex
CREATE INDEX "SocialAccount_modelId_platform_idx" ON "SocialAccount"("modelId", "platform");
