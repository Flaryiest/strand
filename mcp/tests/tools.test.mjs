import test from 'node:test';
import assert from 'node:assert/strict';

import { makeMockFetch, makeMockResponse } from './helpers/mockFetch.mjs';

test('WebSearchTool executes serper search and optionally fetches page content', async () => {
  process.env.SERPER_API_KEY = 'test-key';

  const { WebSearchTool } = await import('../dist/services/tools/WebSearchTool.js');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch([
    {
      match: (url) => url === 'https://google.serper.dev/search',
      handler: async (url, init) => {
        const body = JSON.parse(init.body);
        assert.ok(body.q);
        return makeMockResponse({
          json: {
            organic: [
              {
                title: 'Example Article',
                link: 'https://example.com/article',
                snippet: 'A snippet about ramen',
                date: '2025-01-01'
              }
            ]
          }
        });
      }
    },
    {
      match: (url) => url === 'https://example.com/article',
      handler: async () => makeMockResponse({
        bodyText: '<html><head><title>Example</title><style>badcss{</style></head><body><article><p>Ramen in SF is great.</p></article></body></html>'
      })
    }
  ]);

  try {
    const tool = new WebSearchTool();
    const out = await tool.execute({ query: 'best ramen sf', num: 1, fetchContent: true, maxPages: 1 });

    assert.equal(out.success, true);
    assert.equal(out.results.length, 1);
    assert.ok(out.results[0].content);
    assert.ok(out.results[0].content.text);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RedditSearchTool includes thread comments when enabled', async () => {
  process.env.SERPER_API_KEY = 'test-key';

  const { RedditSearchTool } = await import('../dist/services/tools/RedditSearchTool.js');

  const threadUrl = 'https://www.reddit.com/r/test/comments/abc123/some_slug/';
  const jsonUrl = 'https://www.reddit.com/r/test/comments/abc123/some_slug.json?raw_json=1';

  const mockJson = [
    { data: { children: [{ data: { id: 'abc123', subreddit: 'test', title: 'T', author: 'op', selftext: 'hi', score: 1, num_comments: 2, created_utc: 1, permalink: '/r/test/comments/abc123/some_slug/' } }] } },
    { kind: 'Listing', data: { children: [{ kind: 't1', data: { id: 'c1', author: 'a', body: 'b', score: 3, created_utc: 2, permalink: '/r/test/comments/abc123/some_slug/c1' } }] } }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch([
    {
      match: (url) => url === 'https://google.serper.dev/search',
      handler: async () => makeMockResponse({
        json: {
          organic: [
            { title: 'Thread', link: threadUrl, snippet: 'snippet' }
          ]
        }
      })
    },
    {
      match: (url) => url === jsonUrl,
      handler: async () => makeMockResponse({ json: mockJson })
    }
  ]);

  try {
    const tool = new RedditSearchTool();
    const out = await tool.execute({ query: 'ramen', includeComments: true, maxThreads: 1, maxComments: 5 });

    assert.equal(out.success, true);
    assert.equal(out.results.length, 1);
    assert.ok(out.results[0].thread);
    assert.ok(out.results[0].thread.comments.length >= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
