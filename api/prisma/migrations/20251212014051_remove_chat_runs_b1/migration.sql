/*
  Warnings:

  - You are about to drop the `ChatRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatRunEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChatRun" DROP CONSTRAINT "ChatRun_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRunEvent" DROP CONSTRAINT "ChatRunEvent_runId_fkey";

-- DropTable
DROP TABLE "ChatRun";

-- DropTable
DROP TABLE "ChatRunEvent";
