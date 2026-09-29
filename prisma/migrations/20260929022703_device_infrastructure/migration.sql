-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED', 'DISABLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('IPHONE', 'ANDROID', 'DESKTOP', 'OTHER');

-- CreateEnum
CREATE TYPE "SystemEventType" AS ENUM ('DEVICE_CONNECTED', 'DEVICE_DISCONNECTED', 'ACCOUNT_CONNECTED', 'ACCOUNT_DISCONNECTED', 'AGENT_ENABLED', 'AGENT_DISABLED', 'WORKFLOW_STARTED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "assignedDeviceId" TEXT;

-- CreateTable
CREATE TABLE "DeviceServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "location" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "capabilities" JSONB,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceServerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL DEFAULT 'OTHER',
    "modelLabel" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "serialRef" TEXT,
    "assignedModelId" TEXT,
    "assignedEmployeeId" TEXT,
    "capabilities" JSONB,
    "lastHeartbeat" TIMESTAMP(3),
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "SystemEventType" NOT NULL,
    "message" TEXT,
    "deviceServerId" TEXT,
    "deviceId" TEXT,
    "metadata" JSONB,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceServer_agencyId_idx" ON "DeviceServer"("agencyId");

-- CreateIndex
CREATE INDEX "DeviceServer_status_idx" ON "DeviceServer"("status");

-- CreateIndex
CREATE INDEX "Device_deviceServerId_idx" ON "Device"("deviceServerId");

-- CreateIndex
CREATE INDEX "Device_assignedModelId_idx" ON "Device"("assignedModelId");

-- CreateIndex
CREATE INDEX "Device_assignedEmployeeId_idx" ON "Device"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "Device_agencyId_idx" ON "Device"("agencyId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Event_agencyId_createdAt_idx" ON "Event"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_deviceServerId_idx" ON "Event"("deviceServerId");

-- CreateIndex
CREATE INDEX "Event_deviceId_idx" ON "Event"("deviceId");

-- CreateIndex
CREATE INDEX "SocialAccount_assignedDeviceId_idx" ON "SocialAccount"("assignedDeviceId");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_assignedDeviceId_fkey" FOREIGN KEY ("assignedDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceServer" ADD CONSTRAINT "DeviceServer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceServerId_fkey" FOREIGN KEY ("deviceServerId") REFERENCES "DeviceServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_assignedModelId_fkey" FOREIGN KEY ("assignedModelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_deviceServerId_fkey" FOREIGN KEY ("deviceServerId") REFERENCES "DeviceServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
