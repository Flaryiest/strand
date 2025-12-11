import { fetchText } from './http.js';

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  createdUtc: number;
  depth: number;
  permalink: string;
}

export interface RedditThread {
  id: string;
  url: string;
  subreddit: string;
  title: string;
  author: string;
  selftext?: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
  comments: RedditComment[];
}

function toJsonUrl(threadUrl: string): string {
  const u = new URL(threadUrl);
  u.hash = '';
  u.search = '';

  // Ensure canonical reddit host.
  if (!u.hostname.endsWith('reddit.com')) {
    throw new Error('Not a reddit.com URL');
  }

  const path = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  if (path.endsWith('.json')) {
    return `${u.origin}${path}?raw_json=1`;
  }
  return `${u.origin}${path}.json?raw_json=1`;
}

function pickListingChild(listing: any): any | null {
  const child = listing?.data?.children?.[0];
  return child?.data ?? null;
}

function walkComments(node: any, depth: number, acc: RedditComment[], limit: number): void {
  if (!node || acc.length >= limit) return;

  if (node.kind === 't1') {
    const data = node.data;
    const body = (data?.body || '').trim();
    const author = (data?.author || '').trim();

    if (
      body &&
      author &&
      author !== '[deleted]' &&
      body !== '[deleted]' &&
      body !== '[removed]'
    ) {
      acc.push({
        id: String(data.id || ''),
        author,
        body: body.slice(0, 600),
        score: Number(data.score || 0),
        createdUtc: Number(data.created_utc || 0),
        depth,
        permalink: String(data.permalink || '')
      });
    }

    const replies = data?.replies?.data?.children;
    if (Array.isArray(replies)) {
      for (const child of replies) {
        if (acc.length >= limit) break;
        walkComments(child, depth + 1, acc, limit);
      }
    }
  } else if (node.kind === 'Listing') {
    const children = node?.data?.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (acc.length >= limit) break;
        walkComments(child, depth, acc, limit);
      }
    }
  }
}

export async function fetchRedditThread(threadUrl: string, options?: { maxComments?: number; timeoutMs?: number }): Promise<RedditThread> {
  const maxComments = options?.maxComments ?? 25;
  const timeoutMs = options?.timeoutMs ?? 12_000;

  const jsonUrl = toJsonUrl(threadUrl);
  const text = await fetchText(jsonUrl, {
    timeoutMs,
    maxBytes: 2_000_000,
    headers: { Accept: 'application/json' }
  });

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error('Unexpected reddit JSON shape');
  }

  const post = pickListingChild(parsed[0]);
  if (!post) {
    throw new Error('Missing post data');
  }

  const commentListing = parsed[1];
  const acc: RedditComment[] = [];
  walkComments(commentListing, 0, acc, maxComments);

  // Prefer highest scoring comments as “top comments”.
  acc.sort((a, b) => b.score - a.score);

  return {
    id: String(post.id || ''),
    url: threadUrl,
    subreddit: String(post.subreddit || 'unknown'),
    title: String(post.title || ''),
    author: String(post.author || ''),
    selftext: post.selftext ? String(post.selftext).slice(0, 2000) : undefined,
    score: Number(post.score || 0),
    numComments: Number(post.num_comments || 0),
    createdUtc: Number(post.created_utc || 0),
    permalink: String(post.permalink || ''),
    comments: acc
  };
}
