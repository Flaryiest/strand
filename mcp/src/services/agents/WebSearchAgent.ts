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
  protected maxIterations = 2;
  
  // Store context for access in search method
  private currentContext: AgentContext | null = null;

  /**
   * Early exit heuristic: If we have 5+ articles from different sources, skip LLM eval
   */
  protected checkEarlyExit(results: any[], context: AgentContext): any[] | null {
    if (results.length < 5) return null;
    
    // Count unique sources
    const sources = new Set(results.map((r: any) => r.source).filter(Boolean));
    
    // Need at least 4 different sources to early exit
    if (sources.size >= 4 && results.length >= 5) {
      console.log(`[WebSearchAgent] Early exit: ${results.length} results from ${sources.size} sources`);
      // Return top 8 results
      return results.slice(0, 8);
    }
    
    return null;
  }

  protected getInitialParams(context: AgentContext): Record<string, any> {
    // Store context for use in search
    this.currentContext = context;
    
    // Build a simplified search query (Serper has query length/complexity limits)
    let query = this.simplifyQuery(context.goal);
    if (context.location) {
      // Extract just city name from location
      const city = this.extractCity(context.location);
      query = `${query} ${city}`;
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
  
  /**
   * Simplify complex AI-generated queries to work with Serper's limitations
   * Called during initial param setup
   */
  private simplifyQuery(query: string): string {
    return this.sanitizeSerperQuery(query);
  }
  
  /**
   * Robust query sanitization - called RIGHT BEFORE every Serper API call
   * Handles all edge cases: LLM-generated instructions, verbose refinements, etc.
   */
  private sanitizeSerperQuery(query: string): string {
    let q = query;
    
    // 1. Remove instructional prefixes (expanded list)
    q = q.replace(/^(search|find|look for|get|collect|gather|locate|discover|retrieve|check|browse|explore)\s+(for\s+)?/i, '');
    
    // 2. Remove verbose suffixes
    q = q.replace(/\s+(to capture|for capturing|about|regarding|with|including|official site|official website|menu|photos|hours)\s+.*$/i, '');
    q = q.replace(/\s+(recommendations?|suggestions?|options?|places?|spots?|reviews?)\s*$/i, '');
    
    // 3. Limit quoted phrases to max 2
    const quotes = q.match(/"[^"]+"/g) || [];
    if (quotes.length > 2) {
      let kept = 0;
      q = q.replace(/"[^"]+"/g, (match) => {
        if (kept < 2) { kept++; return match; }
        return match.replace(/"/g, ''); // Remove quotes, keep words
      });
    }
    
    // 4. Remove excessive OR operators
    q = q.replace(/\s+OR\s+/gi, ' ');
    
    // 5. Remove postal codes (they cause issues)
    q = q.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, '');
    
    // 6. Clean up whitespace
    q = q.replace(/\s+/g, ' ').trim();
    
    // 7. Hard cap at 80 chars for web (slightly longer than Reddit)
    if (q.length > 80) {
      q = q.substring(0, 80).replace(/\s+\S*$/, '').trim();
    }
    
    // 8. Fallback: if still empty or too short, extract key nouns
    if (!q || q.length < 3) {
      const words = query.match(/\b[a-z]{4,}\b/gi) || [];
      q = words.slice(0, 4).join(' ') || 'recommendations';
    }
    
    return q;
  }
  
  /**
   * Extract city name from full address
   */
  private extractCity(location: string): string {
    // Try to extract city from address like "44 Edgeland Rd NW, Calgary, AB T3A 2Y4, Canada"
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Second part is usually the city
      return parts[1].replace(/\s+(AB|BC|ON|QC|SK|MB|NS|NB|NL|PE|NT|YT|NU|CA|USA?)$/i, '').trim();
    }
    return location.substring(0, 30);
  }

  protected async search(params: WebSearchParams): Promise<WebSearchResult[]> {
    if (!config.serperApiKey) {
      console.warn('[WebSearchAgent] Serper API key not configured, returning empty results');
      return [];
    }

    // ROBUST: Sanitize query right before API call (catches refinements too)
    const sanitizedQuery = this.sanitizeSerperQuery(params.query);
    console.log(`[WebSearchAgent] Sanitized query: "${params.query.substring(0, 50)}..." → "${sanitizedQuery}"`);

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
          q: sanitizedQuery,
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

      // Fetch page content in PARALLEL for speed
      if (fetchContent && maxPages > 0 && results.length > 0) {
        const pagesToFetch = results.slice(0, maxPages);
        await Promise.all(pagesToFetch.map(async (r) => {
          try {
            const html = await fetchText(r.url, { timeoutMs: 12_000, maxBytes: 2_000_000 });
            r.content = extractReadableContentFromHtml(r.url, html, params.query, {
              maxChars,
              maxExcerptSentences: 5
            });
          } catch (e) {
            r.contentError = e instanceof Error ? e.message : 'Unknown error';
          }
        }));
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

    // Build prompt with error history if available
    const errorContext = context.errorHistory 
      ? this.formatErrorHistoryForPrompt(context.errorHistory)
      : '';

    const prompt = WEB_SEARCH_EVAL_PROMPT
      .replace('{goal}', context.goal)
      .replace('{location}', context.location || 'Not specified')
      .replace('{results}', JSON.stringify(results.slice(0, 10), null, 2))
      + errorContext;

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

