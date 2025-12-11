import { BaseTool } from './BaseTool.js';
import { config } from '../../config.js';
import { fetchText } from '../utils/http.js';
import { extractReadableContentFromHtml, ExtractedPageContent } from '../utils/pageContent.js';

interface WebSearchParams {
  query: string;
  num?: number;
  fetchContent?: boolean;
  maxPages?: number;
  maxChars?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date?: string;
  position: number;
  content?: ExtractedPageContent;
  contentError?: string;
}

/**
 * Raw web search tool using Serper API
 * Can be used directly or through WebSearchAgent for iterative refinement
 */
export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = 'Search the web for articles, reviews, and recommendations. Optionally fetches page content and returns bounded readable text + excerpts.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query (e.g., "best ramen in SF 2024")'
      },
      num: {
        type: 'number',
        description: 'Number of results to return (default: 10, max: 20)'
      },
      fetchContent: {
        type: 'boolean',
        description: 'If true, fetch and extract readable page text + excerpts for top results (default: false)'
      },
      maxPages: {
        type: 'number',
        description: 'Max number of pages to fetch for content extraction (default: 3, max: 5)'
      },
      maxChars: {
        type: 'number',
        description: 'Max characters of extracted text to include per page (default: 6000, max: 12000)'
      }
    },
    required: ['query']
  };

  async execute(params: WebSearchParams): Promise<any> {
    this.validateParams(params);

    if (!config.serperApiKey) {
      throw new Error('Serper API key is not configured. Set SERPER_API_KEY environment variable.');
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: params.query,
          num: Math.min(params.num || 10, 20)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Serper API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      // Transform results
      const results: WebSearchResult[] = (data.organic || []).map((item: any, index: number) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: this.extractDomain(item.link),
        date: item.date,
        position: index + 1
      }));

      const fetchContent = Boolean(params.fetchContent);
      const maxPages = Math.min(Math.max(params.maxPages ?? 3, 0), 5);
      const maxChars = Math.min(Math.max(params.maxChars ?? 6000, 500), 12000);

      if (fetchContent && maxPages > 0 && results.length > 0) {
        const targets = results.slice(0, maxPages);

        for (const r of targets) {
          try {
            const html = await fetchText(r.url, { timeoutMs: 12_000, maxBytes: 2_000_000 });
            r.content = extractReadableContentFromHtml(r.url, html, params.query, {
              maxChars,
              maxExcerptSentences: 5
            });
          } catch (e) {
            r.contentError = e instanceof Error ? e.message : 'Unknown error';
          }
        }
      }

      return {
        success: true,
        query: params.query,
        count: results.length,
        results,
        metadata: {
          searchTime: data.searchParameters?.timeRange,
          contentFetched: fetchContent,
          contentPagesAttempted: fetchContent ? Math.min(maxPages, results.length) : 0,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('WebSearchTool error:', error);
      throw error;
    }
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  }
}

