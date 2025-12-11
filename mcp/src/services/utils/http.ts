export interface FetchTextOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
}

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 2_000_000; // 2MB

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          options.headers?.['User-Agent'] ||
          'StrandAI/1.0 (+https://strand.ai) content-fetcher',
        Accept:
          options.headers?.Accept ||
          'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error(`Response too large (${declaredLength} bytes)`);
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Response too large (${arrayBuffer.byteLength} bytes)`);
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
