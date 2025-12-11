import { BaseTool } from './BaseTool.js';
import { config } from '../../config.js';
import { fetchRedditThread, RedditThread } from '../utils/reddit.js';

interface RedditSearchParams {
  query: string;
  subreddit?: string;
  num?: number;
  includeComments?: boolean;
  maxThreads?: number;
  maxComments?: number;
}

interface RedditSearchResult {
  title: string;
  url: string;
  subreddit: string;
  snippet: string;
  source: string;
  thread?: RedditThread;
  threadError?: string;
}

/**
 * Reddit search tool using Serper API with site:reddit.com
 * Can be used directly or through RedditAgent for iterative refinement
 */
export class RedditSearchTool extends BaseTool {
  name = 'reddit_search';
  description = 'Search Reddit for discussions and local opinions. Optionally fetches thread JSON to include post + top comments (bounded).';
  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query (e.g., "best coffee shops")'
      },
      subreddit: {
        type: 'string',
        description: 'Optional: specific subreddit to search (e.g., "sanfrancisco", "AskNYC")'
      },
      num: {
        type: 'number',
        description: 'Number of results to return (default: 10)'
      },
      includeComments: {
        type: 'boolean',
        description: 'If true, fetch each thread JSON and include top comments/authors (default: true)'
      },
      maxThreads: {
        type: 'number',
        description: 'Max number of threads to fetch content for (default: 3, max: 5)'
      },
      maxComments: {
        type: 'number',
        description: 'Max number of comments to include per fetched thread (default: 25, max: 60)'
      }
    },
    required: ['query']
  };

  async execute(params: RedditSearchParams): Promise<any> {
    this.validateParams(params);

    if (!config.serperApiKey) {
      throw new Error('Serper API key is not configured. Set SERPER_API_KEY environment variable.');
    }

    try {
      // Build Reddit-specific query
      let searchQuery = params.query;
      if (params.subreddit) {
        searchQuery = `${params.query} site:reddit.com/r/${params.subreddit}`;
      } else {
        searchQuery = `${params.query} site:reddit.com`;
      }

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: searchQuery,
          num: Math.min(params.num || 10, 20)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      // Transform and filter for Reddit-only results
      const results: RedditSearchResult[] = (data.organic || [])
        .filter((item: any) => item.link.includes('reddit.com'))
        .map((item: any) => {
          const subredditMatch = item.link.match(/reddit\.com\/r\/([^/]+)/);
          return {
            title: item.title,
            url: item.link,
            subreddit: subredditMatch ? subredditMatch[1] : 'unknown',
            snippet: item.snippet,
            source: 'reddit.com'
          };
        });

      const includeComments = params.includeComments !== false;
      const maxThreads = Math.min(Math.max(params.maxThreads ?? 3, 0), 5);
      const maxComments = Math.min(Math.max(params.maxComments ?? 25, 1), 60);

      if (includeComments && maxThreads > 0 && results.length > 0) {
        const targets = results.slice(0, maxThreads);
        for (const r of targets) {
          try {
            r.thread = await fetchRedditThread(r.url, { maxComments });
          } catch (e) {
            r.threadError = e instanceof Error ? e.message : 'Unknown error';
          }
        }
      }

      return {
        success: true,
        query: params.query,
        subreddit: params.subreddit || 'all',
        count: results.length,
        results,
        metadata: {
          threadsFetched: includeComments,
          threadsAttempted: includeComments ? Math.min(maxThreads, results.length) : 0,
          maxComments,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('RedditSearchTool error:', error);
      throw error;
    }
  }
}

