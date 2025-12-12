import assert from 'node:assert/strict';

function bufferFromString(text) {
  return new TextEncoder().encode(text).buffer;
}

export function makeMockResponse({
  status = 200,
  statusText = 'OK',
  headers = {},
  bodyText = '',
  json = undefined
} = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get(name) {
        return headerMap.get(String(name).toLowerCase()) ?? null;
      }
    },
    async text() {
      if (json !== undefined) return JSON.stringify(json);
      return bodyText;
    },
    async json() {
      if (json === undefined) return JSON.parse(bodyText);
      return json;
    },
    async arrayBuffer() {
      const t = json !== undefined ? JSON.stringify(json) : bodyText;
      return bufferFromString(t);
    }
  };
}

/**
 * Creates a fetch mock that routes by URL prefix or exact URL.
 * routes: Array<{ match: (url, init) => boolean, handler: (url, init) => responseLike }>
 */
export function makeMockFetch(routes) {
  assert(Array.isArray(routes) && routes.length > 0, 'routes must be a non-empty array');

  return async function mockFetch(url, init = {}) {
    const urlStr = typeof url === 'string' ? url : url?.toString?.();
    for (const r of routes) {
      if (r.match(urlStr, init)) {
        return await r.handler(urlStr, init);
      }
    }
    throw new Error(`Unhandled fetch: ${urlStr}`);
  };
}
