import { BaseToolAgent, AgentContext, EvaluationResult } from './BaseToolAgent.js';
import { REDDIT_EVAL_PROMPT } from '../../prompts/agentPrompts.js';
import { config } from '../../config.js';
import { fetchRedditThread, RedditThread } from '../utils/reddit.js';

interface RedditSearchResult {
  title: string;
  subreddit: string;
  url: string;
  snippet?: string;
  thread?: RedditThread;
  threadError?: string;
}

interface RedditSearchParams {
  query: string;
  subreddits?: string[];
  sort?: 'relevance' | 'hot' | 'top' | 'new';
  time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  excludeUrls?: Set<string>; // URLs to exclude from results
}

export class RedditAgent extends BaseToolAgent {
  name = 'reddit_agent';
  description = 'Searches Reddit for authentic local recommendations and discussions';
  protected maxIterations = 2;

  // Cache for AI-determined subreddits to avoid repeated calls
  private subredditCache = new Map<string, string[]>();
  
  // Store context for access in search method
  private currentContext: AgentContext | null = null;

  protected async getInitialParams(context: AgentContext): Promise<Record<string, any>> {
    // Store context for use in search
    this.currentContext = context;
    
    // Find relevant subreddits based on location using AI
    const subreddits = await this.getSubredditsForLocation(context.location, context.goal);
    
    // Simplify query for Serper (has query length/complexity limits)
    const simplifiedQuery = this.simplifyQuery(context.goal);
    
    return {
      query: simplifiedQuery,
      subreddits: subreddits.slice(0, 3), // Start with top 3
      sort: 'relevance',
      time: 'year', // Last year for recency
      excludeUrls: context.seenUrls
    };
  }
  
  /**
   * Simplify complex AI-generated queries to work with Serper's limitations
   */
  private simplifyQuery(query: string): string {
    // Remove instructional phrases that make queries too long
    let simplified = query
      .replace(/^(find|search for|look for|get|collect|gather|locate|discover)\s+/i, '')
      .replace(/\s*(to capture|for capturing|about|regarding|with|including|community opinions|threads|informal consensus|tips)\s+.*$/i, '')
      .replace(/\s*(recommendations?|suggestions?|options?)\s*$/i, '')
      .trim();
    
    // If still too long, take first 50 chars and trim to last complete word
    if (simplified.length > 50) {
      simplified = simplified.substring(0, 50).replace(/\s+\S*$/, '');
    }
    
    return simplified || query.substring(0, 30);
  }

  /**
   * Use AI to find relevant subreddits for any location
   */
  private async getSubredditsForLocation(location?: string, goal?: string): Promise<string[]> {
    const defaultSubs = ['travel', 'solotravel', 'food', 'Foodies', 'dateideas'];
    
    if (!location) return defaultSubs;

    // Check cache first
    const cacheKey = `${location}|${goal || ''}`.toLowerCase();
    if (this.subredditCache.has(cacheKey)) {
      return this.subredditCache.get(cacheKey)!;
    }

    try {
      // Extract city name for cleaner prompt
      const city = this.extractCityFromLocation(location);
      const simplifiedGoal = this.simplifyQuery(goal || 'local recommendations');
      
      const prompt = `Task: Return subreddits for searching "${simplifiedGoal}" in ${city}.

Rules:
- Return ONLY a JSON array of 3-5 subreddit names
- No r/ prefix, just the name
- Prioritize: city sub, city food sub, ask sub
- No explanation, just the array

Example for "burgers in Seattle":
["Seattle", "seattlefood", "AskSeattle"]

Example for "hiking near Denver":
["Denver", "COhiking", "coloradohikers"]

Your response for "${simplifiedGoal}" in ${city}:`;

      const response = await this.callLLM(prompt);
      const subreddits = this.parseJsonResponse<string[]>(response);
      
      if (Array.isArray(subreddits) && subreddits.length > 0) {
        // Cache the result
        this.subredditCache.set(cacheKey, subreddits);
        console.log(`[RedditAgent] AI suggested subreddits for "${location}": ${subreddits.join(', ')}`);
        return subreddits;
      }
    } catch (error) {
      console.error('[RedditAgent] Error getting subreddits from AI:', error);
    }

    // Fallback to defaults
    return defaultSubs;
  }
  
  /**
   * Extract city name from full address
   */
  private extractCityFromLocation(location: string): string {
    // Try to extract city from address like "44 Edgeland Rd NW, Calgary, AB T3A 2Y4, Canada"
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Second part is usually the city
      return parts[1].replace(/\s+(AB|BC|ON|QC|SK|MB|NS|NB|NL|PE|NT|YT|NU|CA|USA?)$/i, '').trim();
    }
    // If no comma, try to extract a city-like word
    const cityMatch = location.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
    return cityMatch ? cityMatch[1] : location.substring(0, 20);
  }

  protected async search(params: RedditSearchParams): Promise<RedditSearchResult[]> {
    // Use web search with site:reddit.com as a fallback
    // Reddit's official API requires OAuth which is complex for this use case
    if (!config.serperApiKey) {
      console.warn('[RedditAgent] Serper API key not configured, cannot search Reddit');
      return [];
    }

    const excludeUrls = params.excludeUrls || this.currentContext?.seenUrls;
    
    // Clean the query - remove any site:reddit.com that LLM might have added
    const cleanQuery = params.query.replace(/\s*site:reddit\.com[^\s]*/gi, '').trim();

    // Build all search queries upfront
    const subreddits = params.subreddits || ['all'];
    const searchQueries = subreddits.map(subreddit => {
      const cleanSub = subreddit.replace(/^r\//i, '');
      return {
        subreddit: cleanSub,
        query: cleanSub === 'all' 
          ? `${cleanQuery} site:reddit.com`
          : `${cleanQuery} site:reddit.com/r/${cleanSub}`
      };
    });

    // Search all subreddits in PARALLEL
    const excludeCount = excludeUrls?.size || 0;
    const requestNum = Math.min(10 + excludeCount, 30);
    
    const searchPromises = searchQueries.map(async ({ query, subreddit }) => {
      console.log(`[RedditAgent] Searching: ${query}`);
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': config.serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: requestNum
          })
        });

        if (!response.ok) {
          console.error(`[RedditAgent] Serper error: ${response.status}`);
          return [];
        }

        const data: any = await response.json();
        const results: RedditSearchResult[] = [];

        // Transform results, filtering out already-seen URLs
        for (const item of data.organic || []) {
          if (!item.link?.includes('reddit.com')) continue;
          
          // Skip already-seen URLs
          if (excludeUrls && excludeUrls.has(item.link)) {
            continue;
          }

          const subredditMatch = item.link.match(/reddit\.com\/r\/([^/]+)/);
          const extractedSubreddit = subredditMatch ? subredditMatch[1] : 'unknown';

          results.push({
            title: item.title,
            subreddit: extractedSubreddit,
            url: item.link,
            snippet: item.snippet
          });
        }
        return results;
      } catch (error) {
        console.error(`[RedditAgent] Error searching ${subreddit}:`, error);
        return [];
      }
    });

    // Wait for all searches to complete in parallel
    const allResults = await Promise.all(searchPromises);
    const results = allResults.flat();

    // Dedupe by URL
    const seen = new Set<string>();
    const deduped = results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
    
    // Add new URLs to the shared seen set
    if (excludeUrls) {
      for (const r of deduped) {
        excludeUrls.add(r.url);
      }
    }

    // Fetch thread content in PARALLEL
    const maxThreads = 5;
    const threadsToFetch = deduped.slice(0, maxThreads);
    await Promise.all(threadsToFetch.map(async (r) => {
      try {
        r.thread = await fetchRedditThread(r.url, { maxComments: 25 });
      } catch (e) {
        r.threadError = e instanceof Error ? e.message : 'Unknown error';
      }
    }));

    console.log(`[RedditAgent] Found ${deduped.length} new Reddit results`);
    return deduped;
  }

  protected async evaluateResults(
    results: RedditSearchResult[],
    context: AgentContext
  ): Promise<EvaluationResult> {
    if (results.length === 0) {
      // Try different subreddits using AI
      const newSubreddits = await this.getSubredditsForLocation(context.location, context.goal);
      return {
        sufficient: false,
        score: 0,
        gaps: ['No Reddit results found'],
        extracted: [],
        refinement: {
          action: 'try_subreddit',
          params: {
            subreddits: newSubreddits.slice(2, 5), // Try different subs
            query: `${context.goal} recommendations`
          }
        }
      };
    }

    const compactForPrompt = results.slice(0, 10).map(r => {
      const thread = r.thread;
      return {
        title: thread?.title || r.title,
        subreddit: thread?.subreddit || r.subreddit,
        url: r.url,
        upvotes: thread?.score || 0,
        commentCount: thread?.numComments || 0,
        postExcerpt: (thread?.selftext || r.snippet || '').slice(0, 400),
        topComments: (thread?.comments || []).slice(0, 6).map(c => ({
          author: c.author,
          score: c.score,
          body: c.body.slice(0, 280)
        })),
        threadError: r.threadError
      };
    });

    const prompt = REDDIT_EVAL_PROMPT
      .replace('{goal}', context.goal)
      .replace('{location}', context.location || 'Not specified')
      .replace('{results}', JSON.stringify(compactForPrompt, null, 2));

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
        extracted: evaluation.extracted || this.defaultExtract(results),
        refinement: evaluation.refinement
      };
    } catch (error) {
      console.error('[RedditAgent] Evaluation error:', error);
      // Fallback heuristic
      const hasGoodResults = results.length >= 3;
      return {
        sufficient: hasGoodResults,
        score: hasGoodResults ? 6 : 3,
        gaps: ['Evaluation failed, using heuristic'],
        extracted: this.defaultExtract(results)
      };
    }
  }

  private defaultExtract(results: RedditSearchResult[]): any[] {
    return results.slice(0, 8).map(r => {
      const thread = r.thread;
      const topComments = thread?.comments?.slice(0, 5) || [];
      return {
        title: thread?.title || r.title,
        subreddit: thread?.subreddit || r.subreddit,
        url: r.url,
        upvotes: thread?.score || 0,
        commentCount: thread?.numComments || 0,
        topRecommendations: [],
        keyInsights: [
          thread?.selftext ? String(thread.selftext).slice(0, 280) : (r.snippet || '').slice(0, 280),
          ...topComments.map(c => `${c.author}: ${c.body.slice(0, 220)}`)
        ].filter(Boolean)
      };
    });
  }

  protected getResultKey(result: RedditSearchResult): string {
    return result.url;
  }
}

