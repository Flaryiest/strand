import { BaseTool } from './BaseTool.js';
import { config } from '../../config.js';

interface WebSearchParams {
  query: string;
  num?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date?: string;
  position: number;
}

/**
 * Raw web search tool using Serper API
 * Can be used directly or through WebSearchAgent for iterative refinement
 */
export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = 'Search the web for articles, reviews, and recommendations. Returns titles, URLs, and snippets from top results.';
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

      return {
        success: true,
        query: params.query,
        count: results.length,
        results,
        metadata: {
          searchTime: data.searchParameters?.timeRange,
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

