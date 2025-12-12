import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2
    });

    redis.on('error', (err) => {
      console.error('[Redis] error:', err);
    });
  }

  return redis;
}

export function createRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2
  });

  client.on('error', (err) => {
    console.error('[Redis] error:', err);
  });

  return client;
}

export function runMetaKey(runId: string) {
  return `chatrun:meta:${runId}`;
}

export function runStreamKey(runId: string) {
  return `chatrun:stream:${runId}`;
}

export type ChatRunMeta = {
  userId: number;
  conversationId: number;
  assistantMessageId: number;
  status: string;
};

export async function setRunMeta(runId: string, meta: ChatRunMeta, ttlSeconds = 60 * 60 * 24) {
  const client = getRedis();
  await client.hset(runMetaKey(runId), {
    userId: String(meta.userId),
    conversationId: String(meta.conversationId),
    assistantMessageId: String(meta.assistantMessageId),
    status: meta.status
  });
  await client.expire(runMetaKey(runId), ttlSeconds);
  await client.expire(runStreamKey(runId), ttlSeconds);
}

export async function patchRunMeta(runId: string, patch: Partial<ChatRunMeta>, ttlSeconds = 60 * 60 * 24) {
  const client = getRedis();
  const payload: Record<string, string> = {};
  if (patch.userId !== undefined) payload.userId = String(patch.userId);
  if (patch.conversationId !== undefined) payload.conversationId = String(patch.conversationId);
  if (patch.assistantMessageId !== undefined) payload.assistantMessageId = String(patch.assistantMessageId);
  if (patch.status !== undefined) payload.status = String(patch.status);

  if (Object.keys(payload).length > 0) {
    await client.hset(runMetaKey(runId), payload);
  }

  await client.expire(runMetaKey(runId), ttlSeconds);
  await client.expire(runStreamKey(runId), ttlSeconds);
}

export async function getRunMeta(runId: string): Promise<ChatRunMeta | null> {
  const client = getRedis();
  const data = await client.hgetall(runMetaKey(runId));
  if (!data || Object.keys(data).length === 0) return null;

  const userId = Number.parseInt(data.userId || '', 10);
  const conversationId = Number.parseInt(data.conversationId || '', 10);
  const assistantMessageId = Number.parseInt(data.assistantMessageId || '', 10);

  if (!Number.isFinite(userId) || !Number.isFinite(conversationId) || !Number.isFinite(assistantMessageId)) {
    return null;
  }

  return {
    userId,
    conversationId,
    assistantMessageId,
    status: data.status || 'unknown'
  };
}

export async function appendRunEvent(runId: string, event: unknown): Promise<string> {
  const client = getRedis();
  const id = await client.xadd(runStreamKey(runId), '*', 'json', JSON.stringify(event));
  return id;
}

export async function readRunEvents(runId: string, afterId: string, count = 200) {
  const client = getRedis();
  // XREAD returns entries with id > afterId
  const result = await client.xread('COUNT', count, 'STREAMS', runStreamKey(runId), afterId);
  return result;
}
