-- CreateTable
CREATE TABLE "ChatRun" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "userMessageId" INTEGER NOT NULL,
    "assistantMessageId" INTEGER NOT NULL,
    "location" TEXT,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRunEvent" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatRun_userId_idx" ON "ChatRun"("userId");

-- CreateIndex
CREATE INDEX "ChatRun_conversationId_idx" ON "ChatRun"("conversationId");

-- CreateIndex
CREATE INDEX "ChatRun_status_idx" ON "ChatRun"("status");

-- CreateIndex
CREATE INDEX "ChatRunEvent_runId_seq_idx" ON "ChatRunEvent"("runId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRunEvent_runId_seq_key" ON "ChatRunEvent"("runId", "seq");

-- AddForeignKey
ALTER TABLE "ChatRun" ADD CONSTRAINT "ChatRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRunEvent" ADD CONSTRAINT "ChatRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChatRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
