import { BaseToolAgent, AgentContext, EvaluationResult } from './BaseToolAgent.js';
import { WEB_SEARCH_EVAL_PROMPT } from '../../prompts/agentPrompts.js';
import { config } from '../../config.js';
import { fetchText } from '../utils/http.js';
import { extractReadableContentFromHtml, ExtractedPageContent } from '../utils/pageContent.js';

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  date?: string;
  position: number;
  content?: ExtractedPageContent;
  contentError?: string;
}

interface WebSearchParams {
  query: string;
  num?: number;
  fetchContent?: boolean;
  maxPages?: number;
  maxChars?: number;
  excludeUrls?: Set<string>; // URLs to exclude from results
}

export class WebSearchAgent extends BaseToolAgent {
  name = 'web_agent';
  description = 'Searches the web for articles, reviews, and recommendations using Serper API';
  protected maxIterations = 3;
  
  // Store context for access in search method
  private currentContext: AgentContext | null = null;

  protected getInitialParams(context: AgentContext): Record<string, any> {
    // Store context for use in search
    this.currentContext = context;
    
    // Build an optimized search query
    let query = context.goal;
    if (context.location) {
      query = `${context.goal} ${context.location}`;
    }
    // Add "best" for recommendation queries
    if (!query.toLowerCase().includes('best') && !query.toLowerCase().includes('top')) {
      query = `best ${query}`;
    }
    return { 
      query, 
      num: 10, 
      fetchContent: true, 
      maxPages: 3, 
      maxChars: 6000,
      excludeUrls: context.seenUrls
    };
  }

  protected async search(params: WebSearchParams): Promise<WebSearchResult[]> {
    if (!config.serperApiKey) {
      console.warn('[WebSearchAgent] Serper API key not configured, returning empty results');
      return [];
    }

    console.log(`[WebSearchAgent] Searching: ${params.query}`);

    try {
      // Calculate num, capping at Serper's max of 30
      const excludeCount = params.excludeUrls?.size || 0;
      const requestNum = Math.min((params.num || 10) + excludeCount, 30);
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: params.query,
          num: requestNum
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      // Transform organic results, filtering out already-seen URLs
      const excludeUrls = params.excludeUrls || this.currentContext?.seenUrls;
      let results: WebSearchResult[] = (data.organic || [])
        .filter((item: any) => {
          if (excludeUrls && excludeUrls.has(item.link)) {
            console.log(`[WebSearchAgent] Filtering out already-seen URL: ${item.link}`);
            return false;
          }
          return true;
        })
        .map((item: any, index: number) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          source: this.extractDomain(item.link),
          date: item.date,
          position: index + 1
        }));
      
      // Add new URLs to the seen set
      if (excludeUrls) {
        for (const r of results) {
          excludeUrls.add(r.url);
        }
      }

      const fetchContent = params.fetchContent !== false;
      const maxPages = Math.min(Math.max(params.maxPages ?? 3, 0), 5);
      const maxChars = Math.min(Math.max(params.maxChars ?? 6000, 500), 12000);

      if (fetchContent && maxPages > 0 && results.length > 0) {
        for (const r of results.slice(0, maxPages)) {
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

      console.log(`[WebSearchAgent] Found ${results.length} new web results (filtered from ${data.organic?.length || 0})`);
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

