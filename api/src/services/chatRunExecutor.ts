import type { Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MCP_URL = process.env.MCP_URL || 'https://mcp.usestrand.space';

type Subscriber = {
  res: Response;
  keepAliveId: NodeJS.Timeout;
};

const subscribersByRunId = new Map<string, Set<Subscriber>>();

function writeSse(res: Response, seq: number, payload: unknown) {
  res.write(`id: ${seq}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(runId: string, seq: number, payload: unknown) {
  const subscribers = subscribersByRunId.get(runId);
  if (!subscribers || subscribers.size === 0) return;

  for (const sub of subscribers) {
    try {
      writeSse(sub.res, seq, payload);
    } catch {
      // Ignore write errors; cleanup will happen on close.
    }
  }
}

export function addRunSubscriber(runId: string, res: Response) {
  const keepAliveId = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      // ignore
    }
  }, 20000);

  const subscriber: Subscriber = { res, keepAliveId };

  const set = subscribersByRunId.get(runId) ?? new Set<Subscriber>();
  set.add(subscriber);
  subscribersByRunId.set(runId, set);

  const remove = () => {
    clearInterval(keepAliveId);
    const current = subscribersByRunId.get(runId);
    if (!current) return;
    current.delete(subscriber);
    if (current.size === 0) subscribersByRunId.delete(runId);
  };

  return remove;
}

export async function startChatRun(runId: string) {
  const run = await prisma.chatRun.findUnique({
    where: { id: runId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      }
    }
  });

  if (!run) {
    throw new Error(`ChatRun not found: ${runId}`);
  }

  await prisma.chatRun.update({
    where: { id: runId },
    data: {
      status: 'running',
      startedAt: new Date(),
      error: null
    }
  });

  // Build chat history, excluding the assistant placeholder message (empty content).
  const history = run.conversation.messages
    .filter((msg) => {
      if (msg.role === 'user') return true;
      if (msg.role === 'assistant') return (msg.content || '').trim().length > 0;
      return false;
    })
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

  const mcpPayload = {
    userId: run.userId,
    conversationId: run.conversationId,
    messages: history,
    location: run.location || null
  };

  const startTime = Date.now();
  const eventLog: any[] = [];
  let fullResponse = '';
  let tokenCount = 0;
  let toolCallCount = 0;
  let itineraryData: any = null;

  let seq = run.lastSeq;
  let pending: Array<{ seq: number; type: string; data: any }> = [];
  let lastFlushAt = 0;

  const flush = async () => {
    if (pending.length === 0) return;

    const toFlush = pending;
    pending = [];

    await prisma.chatRunEvent.createMany({
      data: toFlush.map((e) => ({
        runId,
        seq: e.seq,
        type: e.type,
        data: e.data
      }))
    });

    await prisma.chatRun.update({
      where: { id: runId },
      data: { lastSeq: seq }
    });

    // Update assistant placeholder content occasionally so history has partial text.
    await prisma.message.update({
      where: { id: run.assistantMessageId },
      data: {
        content: fullResponse,
        metadata: {
          status: 'streaming',
          runId
        }
      }
    });

    for (const e of toFlush) {
      broadcast(runId, e.seq, e.data);
    }

    lastFlushAt = Date.now();
  };

  try {
    const response = await fetch(`${MCP_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mcpPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP service returned ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Failed to connect to MCP service: No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const eventData = JSON.parse(line.substring(6));
          eventLog.push(eventData);

          seq += 1;
          pending.push({ seq, type: String(eventData.type || 'unknown'), data: eventData });

          if (eventData.type === 'token') {
            fullResponse += eventData.data?.message || '';
            tokenCount++;
          }
          if (eventData.type === 'action') {
            toolCallCount++;
          }
          if (eventData.type === 'done' && eventData.data?.itinerary) {
            itineraryData = eventData.data.itinerary;
          }

          const now = Date.now();
          if (pending.length >= 25 || now - lastFlushAt >= 300) {
            await flush();
          }
        } catch {
          // Ignore non-JSON or partial lines.
        }
      }
    }

    await flush();

    const processingTime = Date.now() - startTime;

    // Finalize assistant message
    await prisma.message.update({
      where: { id: run.assistantMessageId },
      data: {
        content: fullResponse,
        eventLog,
        metadata: {
          status: 'done',
          runId,
          mcpPayload,
          itinerary: itineraryData
        },
        tokensUsed: tokenCount,
        toolCallsCount: toolCallCount,
        processingTime
      }
    });

    // Update conversation title if it's the first message
    if (!run.conversation.title && run.conversation.messages.filter((m) => m.role === 'user').length === 1) {
      await prisma.conversation.update({
        where: { id: run.conversationId },
        data: { title: (run.conversation.messages.findLast((m) => m.role === 'user')?.content || '').substring(0, 50) }
      });
    }

    await prisma.chatRun.update({
      where: { id: runId },
      data: { status: 'done', finishedAt: new Date() }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Run failed';

    // Persist an error event so clients see it on replay.
    seq += 1;
    const errorEvent = {
      type: 'error',
      data: { message: 'Failed to connect to AI service' }
    };

    await prisma.chatRunEvent.create({
      data: {
        runId,
        seq,
        type: 'error',
        data: errorEvent
      }
    });

    await prisma.message.update({
      where: { id: run.assistantMessageId },
      data: {
        metadata: {
          status: 'error',
          runId,
          error: message
        }
      }
    });

    await prisma.chatRun.update({
      where: { id: runId },
      data: { status: 'error', error: message, lastSeq: seq, finishedAt: new Date() }
    });

    broadcast(runId, seq, errorEvent);
  } finally {
    // Best-effort: close subscribers once run is finished.
    const subs = subscribersByRunId.get(runId);
    if (subs) {
      for (const sub of subs) {
        try {
          clearInterval(sub.keepAliveId);
          sub.res.end();
        } catch {
          // ignore
        }
      }
      subscribersByRunId.delete(runId);
    }
  }
}
