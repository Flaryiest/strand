/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prompt` to the `Strand` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Strand" ADD COLUMN     "prompt" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "profilePicture" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
