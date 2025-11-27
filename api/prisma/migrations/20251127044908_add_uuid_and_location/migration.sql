/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - The required column `uuid` was added to the `Conversation` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable: Add columns (uuid as nullable first)
ALTER TABLE "Conversation" ADD COLUMN "creditCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "initialLocation" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "uuid" TEXT;

-- Populate uuid for existing rows with generated UUIDs
UPDATE "Conversation" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;

-- Make uuid required after populating
ALTER TABLE "Conversation" ALTER COLUMN "uuid" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_uuid_key" ON "Conversation"("uuid");

-- CreateIndex
CREATE INDEX "Conversation_uuid_idx" ON "Conversation"("uuid");
