import test from 'node:test';
import assert from 'node:assert/strict';

import { makeMockFetch, makeMockResponse } from './helpers/mockFetch.mjs';

test('fetchRedditThread parses post + bounded top comments', async () => {
  const { fetchRedditThread } = await import('../dist/services/utils/reddit.js');

  const threadUrl = 'https://www.reddit.com/r/test/comments/abc123/some_slug/';
  const jsonUrl = 'https://www.reddit.com/r/test/comments/abc123/some_slug.json?raw_json=1';

  const mockJson = [
    {
      data: {
        children: [
          {
            data: {
              id: 'abc123',
              subreddit: 'test',
              title: 'Best ramen?',
              author: 'op',
              selftext: 'x'.repeat(5000),
              score: 111,
              num_comments: 999,
              created_utc: 1700000000,
              permalink: '/r/test/comments/abc123/some_slug/'
            }
          }
        ]
      }
    },
    {
      kind: 'Listing',
      data: {
        children: [
          {
            kind: 't1',
            data: {
              id: 'c1',
              author: 'alice',
              body: 'a'.repeat(2000),
              score: 5,
              created_utc: 1700000001,
              permalink: '/r/test/comments/abc123/some_slug/c1'
            }
          },
          {
            kind: 't1',
            data: {
              id: 'c2',
              author: 'bob',
              body: 'short comment',
              score: 50,
              created_utc: 1700000002,
              permalink: '/r/test/comments/abc123/some_slug/c2',
              replies: {
                data: {
                  children: [
                    {
                      kind: 't1',
                      data: {
                        id: 'c3',
                        author: 'carol',
                        body: 'nested',
                        score: 10,
                        created_utc: 1700000003,
                        permalink: '/r/test/comments/abc123/some_slug/c3'
                      }
                    }
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeMockFetch([
    {
      match: (url) => url === jsonUrl,
      handler: async () => makeMockResponse({ json: mockJson })
    }
  ]);

  try {
    const thread = await fetchRedditThread(threadUrl, { maxComments: 2 });

    assert.equal(thread.id, 'abc123');
    assert.equal(thread.subreddit, 'test');
    // selftext should be truncated
    assert.ok(thread.selftext.length <= 2000);

    // maxComments=2
    assert.equal(thread.comments.length, 2);
    // should be sorted by score desc (bob then carol OR bob then alice depending on traversal)
    assert.ok(thread.comments[0].score >= thread.comments[1].score);

    // comment body truncation
    for (const c of thread.comments) {
      assert.ok(c.body.length <= 600);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
