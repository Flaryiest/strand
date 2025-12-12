import { PrismaClient } from '@prisma/client';
import { appendRunEvent, patchRunMeta } from './redis.js';

const prisma = new PrismaClient();

const MCP_URL = process.env.MCP_URL || 'https://mcp.usestrand.space';

export async function startChatRun(runId: string, params: {
  userId: number;
  conversationId: number;
  assistantMessageId: number;
  location?: string | null;
}) {
  const { userId, conversationId, assistantMessageId, location } = params;

  await patchRunMeta(runId, { status: 'running' });

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!conversation) {
    throw new Error('Conversation not found for run');
  }

  const history = conversation.messages
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
    userId,
    conversationId,
    messages: history,
    location: location || null
  };

  const startTime = Date.now();
  const eventLog: any[] = [];
  let fullResponse = '';
  let tokenCount = 0;
  let toolCallCount = 0;
  let itineraryData: any = null;
  let lastDbUpdateAt = 0;

  const maybeUpdateDb = async () => {
    const now = Date.now();
    if (now - lastDbUpdateAt < 750) return;
    lastDbUpdateAt = now;
    await prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        content: fullResponse,
        metadata: {
          status: 'streaming',
          runId
        }
      }
    });
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

          await appendRunEvent(runId, eventData);

          if (eventData.type === 'token') {
            fullResponse += eventData.data?.message || '';
            tokenCount++;
            await maybeUpdateDb();
          }
          if (eventData.type === 'action') {
            toolCallCount++;
          }
          if (eventData.type === 'done' && eventData.data?.itinerary) {
            itineraryData = eventData.data.itinerary;
          }
        } catch {
          // ignore
        }
      }
    }

    const processingTime = Date.now() - startTime;

    await prisma.message.update({
      where: { id: assistantMessageId },
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
    const userCount = conversation.messages.filter((m) => m.role === 'user').length;
    if (!conversation.title && userCount === 1) {
      const firstUser = conversation.messages.find((m) => m.role === 'user');
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: (firstUser?.content || '').substring(0, 50) }
      });
    }

    await patchRunMeta(runId, { status: 'done' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Run failed';
    const errorEvent = {
      type: 'error',
      data: { message: 'Failed to connect to AI service' }
    };

    try {
      await appendRunEvent(runId, errorEvent);
    } catch {
      // ignore
    }

    await prisma.message.update({
      where: { id: assistantMessageId },
      data: {
        metadata: {
          status: 'error',
          runId,
          error: message
        }
      }
    });

    await patchRunMeta(runId, { status: 'error' });
  }
}
