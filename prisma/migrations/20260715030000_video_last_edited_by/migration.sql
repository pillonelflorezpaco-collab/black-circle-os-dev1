-- AlterTable
ALTER TABLE "Video" ADD COLUMN "lastEditedById" TEXT;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
