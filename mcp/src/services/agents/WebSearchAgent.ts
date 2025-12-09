import { BaseToolAgent, AgentContext, EvaluationResult } from './BaseToolAgent.js';
import { WEB_SEARCH_EVAL_PROMPT } from '../../prompts/agentPrompts.js';
import { config } from '../../config.js';

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  position: number;
}

interface WebSearchParams {
  query: string;
  num?: number;
}

export class WebSearchAgent extends BaseToolAgent {
  name = 'web_agent';
  description = 'Searches the web for articles, reviews, and recommendations using Serper API';
  protected maxIterations = 3;

  protected getInitialParams(context: AgentContext): Record<string, any> {
    // Build an optimized search query
    let query = context.goal;
    if (context.location) {
      query = `${context.goal} ${context.location}`;
    }
    // Add "best" for recommendation queries
    if (!query.toLowerCase().includes('best') && !query.toLowerCase().includes('top')) {
      query = `best ${query}`;
    }
    return { query, num: 10 };
  }

  protected async search(params: WebSearchParams): Promise<WebSearchResult[]> {
    if (!config.serperApiKey) {
      console.warn('[WebSearchAgent] Serper API key not configured, returning empty results');
      return [];
    }

    console.log(`[WebSearchAgent] Searching: ${params.query}`);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: params.query,
          num: params.num || 10
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      // Transform organic results
      const results: WebSearchResult[] = (data.organic || []).map((item: any, index: number) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: this.extractDomain(item.link),
        date: item.date,
        position: index + 1
      }));

      console.log(`[WebSearchAgent] Found ${results.length} web results`);
      return results;
    } catch (error) {
      console.error('[WebSearchAgent] Search error:', error);
      return [];
    }
  }

  protected async evaluateResults(
    results: WebSearchResult[],
    context: AgentContext
  ): Promise<EvaluationResult> {
    if (results.length === 0) {
      return {
        sufficient: false,
        score: 0,
        gaps: ['No web search results found'],
        extracted: [],
        refinement: {
          action: 'modify_query',
          params: { query: `${context.goal} ${context.location || ''} recommendations` }
        }
      };
    }

    const prompt = WEB_SEARCH_EVAL_PROMPT
      .replace('{goal}', context.goal)
      .replace('{location}', context.location || 'Not specified')
      .replace('{results}', JSON.stringify(results.slice(0, 10), null, 2));

    try {
      const response = await this.callLLM(prompt);
      const evaluation = this.parseJsonResponse<{
        sufficient: boolean;
        score: number;
        gaps: string[];
        extracted: any[];
        refinement?: {
          action: string;
          params: Record<string, any>;
        };
      }>(response);

      return {
        sufficient: evaluation.sufficient,
        score: evaluation.score,
        gaps: evaluation.gaps || [],
        extracted: evaluation.extracted || results.slice(0, 8),
        refinement: evaluation.refinement
      };
    } catch (error) {
      console.error('[WebSearchAgent] Evaluation error:', error);
      // Fallback heuristic
      const hasGoodResults = results.length >= 5;
      return {
        sufficient: hasGoodResults,
        score: hasGoodResults ? 6 : 3,
        gaps: ['Evaluation failed, using heuristic'],
        extracted: results.slice(0, 8).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          mentions: []
        }))
      };
    }
  }

  protected getResultKey(result: WebSearchResult): string {
    return result.url;
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

