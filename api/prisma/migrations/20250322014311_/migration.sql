/*
  Warnings:

  - You are about to drop the column `Experience` on the `Skill` table. All the data in the column will be lost.
  - You are about to drop the column `Level` on the `Skill` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "Experience",
DROP COLUMN "Level",
ADD COLUMN     "experience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1;
