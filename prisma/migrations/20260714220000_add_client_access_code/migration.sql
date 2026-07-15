-- AlterTable
ALTER TABLE "Client" ADD COLUMN "accessCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_accessCode_key" ON "Client"("accessCode");
