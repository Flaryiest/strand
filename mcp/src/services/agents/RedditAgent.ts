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
    
    // 1. Remove site:reddit.com (we add it ourselves)
    q = q.replace(/\s*site:reddit\.com[^\s]*/gi, '');
    
    // 2. Remove instructional prefixes (expanded list)
    q = q.replace(/^(search|find|look for|get|collect|gather|locate|discover|retrieve|check|browse|explore)\s+(for\s+)?/i, '');
    q = q.replace(/^(local forums|reddit|r\/\w+)\s+(for\s+)?/i, '');
    q = q.replace(/^\(r\/[^)]+\)\s*/gi, ''); // Remove (r/subreddit) prefix
    
    // 3. Remove parenthetical content like (r/Calgary)
    q = q.replace(/\([^)]*\)/g, ' ');
    
    // 4. Remove verbose suffixes
    q = q.replace(/\s+(to capture|for capturing|about|regarding|with|including|community opinions|threads|informal consensus|tips|specifically mentioning|at these shops).*$/i, '');
    q = q.replace(/\s+(recommendations?|suggestions?|options?|reviews?)\s*$/i, '');
    
    // 5. Limit quoted phrases to max 2, remove the rest
    const quotes = q.match(/"[^"]+"/g) || [];
    if (quotes.length > 2) {
      // Keep only first 2 quoted phrases
      let kept = 0;
      q = q.replace(/"[^"]+"/g, (match) => {
        if (kept < 2) { kept++; return match; }
        return match.replace(/"/g, ''); // Remove quotes, keep words
      });
    }
    
    // 6. Remove excessive OR operators
    q = q.replace(/\s+OR\s+/gi, ' ');
    
    // 7. Clean up whitespace
    q = q.replace(/\s+/g, ' ').trim();
    
    // 8. Hard cap at 60 chars, trim to last complete word
    if (q.length > 60) {
      q = q.substring(0, 60).replace(/\s+\S*$/, '').trim();
    }
    
    // 9. Fallback: if still empty or too short, extract key nouns
    if (!q || q.length < 3) {
      // Try to extract meaningful words from original
      const words = query.match(/\b[a-z]{4,}\b/gi) || [];
      q = words.slice(0, 3).join(' ') || 'recommendations';
    }
    
    return q;
  }
  
  /**
   * Add recency hint to query if not already present
   * Helps surface more recent Reddit threads
   */
  private addRecencyHint(query: string): string {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    
    // Check if query already has a year
    const hasYear = /\b20[2-3]\d\b/.test(query);
    if (hasYear) return query;
    
    // Check if query already has recency terms
    const hasRecency = /\b(recent|latest|new|now|currently|this year)\b/i.test(query);
    if (hasRecency) return query;
    
    // Add year hint - use "2024 OR 2025" style to be flexible
    // Keep it short to not bloat the query
    return `${query} ${lastYear}`;
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
    const excludeUrls = params.excludeUrls || this.currentContext?.seenUrls;
    const subreddits = params.subreddits || ['all'];
    
    // Sanitize query for both Reddit native and Serper
    const cleanQuery = this.sanitizeSerperQuery(params.query);
    console.log(`[RedditAgent] Sanitized query: "${params.query}" → "${cleanQuery}"`);

    // Try Reddit's native search first (better relevance, native time filtering)
    let results = await this.searchRedditNative(cleanQuery, subreddits, params, excludeUrls);
    
    // Fallback to Serper if Reddit native returned too few results
    if (results.length < 3) {
      console.log(`[RedditAgent] Reddit native returned ${results.length} results, falling back to Serper`);
      const serperResults = await this.searchSerper(cleanQuery, subreddits, params, excludeUrls);
      
      // Merge results, avoiding duplicates
      const existingUrls = new Set(results.map(r => r.url));
      for (const r of serperResults) {
        if (!existingUrls.has(r.url)) {
          results.push(r);
          existingUrls.add(r.url);
        }
      }
    }

    // Dedupe by URL (in case of any overlap)
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

    // Fetch thread content in PARALLEL (fetch more than we need for filtering)
    const maxThreadsToFetch = Math.min(deduped.length, 8);
    const threadsToFetch = deduped.slice(0, maxThreadsToFetch);
    await Promise.all(threadsToFetch.map(async (r) => {
      try {
        r.thread = await fetchRedditThread(r.url, { maxComments: 25 });
      } catch (e) {
        r.threadError = e instanceof Error ? e.message : 'Unknown error';
      }
    }));

    // Apply quality filters with fallback to avoid being too restrictive
    const filtered = this.filterByQuality(deduped);
    
    console.log(`[RedditAgent] Found ${deduped.length} results, ${filtered.length} after quality filter`);
    return filtered;
  }

  /**
   * Search using Reddit's native JSON search endpoint (no API key needed)
   * Better relevance sorting and native time filtering
   */
  private async searchRedditNative(
    query: string,
    subreddits: string[],
    params: RedditSearchParams,
    excludeUrls?: Set<string>
  ): Promise<RedditSearchResult[]> {
    const timeFilter = params.time || 'year';
    const sort = params.sort || 'relevance';
    
    const searchPromises = subreddits.map(async (subreddit) => {
      const cleanSub = subreddit.replace(/^r\//i, '');
      
      // Build Reddit search URL
      // For 'all', search across all of Reddit; otherwise restrict to subreddit
      const baseUrl = cleanSub === 'all'
        ? 'https://www.reddit.com/search.json'
        : `https://www.reddit.com/r/${cleanSub}/search.json`;
      
      const searchParams = new URLSearchParams({
        q: query,
        sort: sort,
        t: timeFilter,
        limit: '25',
        restrict_sr: cleanSub === 'all' ? '0' : '1',
        type: 'link' // Only posts, not comments
      });
      
      const url = `${baseUrl}?${searchParams.toString()}`;
      console.log(`[RedditAgent] Reddit native search: ${cleanSub} - "${query}"`);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'StrandAI/1.0 (location discovery bot)',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          // Reddit might rate limit or block - this is expected sometimes
          if (response.status === 429) {
            console.warn(`[RedditAgent] Reddit rate limited (429) for ${cleanSub}`);
          } else {
            console.warn(`[RedditAgent] Reddit native error: ${response.status} for ${cleanSub}`);
          }
          return [];
        }
        
        const data: any = await response.json();
        const results: RedditSearchResult[] = [];
        
        const children = data?.data?.children || [];
        for (const child of children) {
          const post = child?.data;
          if (!post) continue;
          
          // Build the full URL
          const postUrl = `https://www.reddit.com${post.permalink}`;
          
          // Skip already-seen URLs
          if (excludeUrls && excludeUrls.has(postUrl)) {
            continue;
          }
          
          // Skip non-text posts (videos, images only) - we want discussions
          if (post.is_video || (post.post_hint === 'image' && !post.selftext)) {
            continue;
          }
          
          results.push({
            title: post.title || '',
            subreddit: post.subreddit || cleanSub,
            url: postUrl,
            snippet: (post.selftext || '').slice(0, 300),
            // We'll fetch full thread data later, but store basic metadata
            thread: {
              id: post.id,
              url: postUrl,
              subreddit: post.subreddit,
              title: post.title,
              author: post.author,
              selftext: post.selftext?.slice(0, 2000),
              score: post.score || 0,
              numComments: post.num_comments || 0,
              createdUtc: post.created_utc || 0,
              permalink: post.permalink,
              comments: [] // Will be populated if we fetch full thread
            }
          });
        }
        
        return results;
      } catch (error) {
        console.error(`[RedditAgent] Reddit native error for ${cleanSub}:`, error);
        return [];
      }
    });
    
    // Wait for all searches in parallel
    const allResults = await Promise.all(searchPromises);
    return allResults.flat();
  }

  /**
   * Fallback: Search using Serper API with site:reddit.com
   * Good for discovery when Reddit native fails or is rate limited
   */
  private async searchSerper(
    query: string,
    subreddits: string[],
    params: RedditSearchParams,
    excludeUrls?: Set<string>
  ): Promise<RedditSearchResult[]> {
    if (!config.serperApiKey) {
      console.warn('[RedditAgent] Serper API key not configured, skipping fallback');
      return [];
    }
    
    // Add recency hint for Serper (since it doesn't have native time filter)
    const queryWithRecency = this.addRecencyHint(query);
    
    const searchQueries = subreddits.map(subreddit => {
      const cleanSub = subreddit.replace(/^r\//i, '');
      return {
        subreddit: cleanSub,
        query: cleanSub === 'all' 
          ? `${queryWithRecency} site:reddit.com`
          : `${queryWithRecency} site:reddit.com/r/${cleanSub}`
      };
    });

    const excludeCount = excludeUrls?.size || 0;
    const requestNum = Math.min(10 + excludeCount, 30);
    
    const searchPromises = searchQueries.map(async ({ query: searchQuery, subreddit }) => {
      console.log(`[RedditAgent] Serper fallback: ${searchQuery}`);
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': config.serperApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: searchQuery,
            num: requestNum
          })
        });

        if (!response.ok) {
          console.error(`[RedditAgent] Serper error: ${response.status}`);
          return [];
        }

        const data: any = await response.json();
        const results: RedditSearchResult[] = [];

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
        console.error(`[RedditAgent] Serper error for ${subreddit}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    return allResults.flat();
  }
  
  /**
   * Filter results by recency and engagement, with fallback to go broad
   * if filtering removes too many results
   */
  private filterByQuality(results: RedditSearchResult[]): RedditSearchResult[] {
    const now = Date.now() / 1000; // Unix timestamp
    const THREE_YEARS_AGO = now - (3 * 365 * 24 * 60 * 60);
    const ONE_YEAR_AGO = now - (365 * 24 * 60 * 60);
    
    // Engagement thresholds (soft - we'll relax if needed)
    const MIN_UPVOTES_STRICT = 5;
    const MIN_COMMENTS_STRICT = 3;
    const MIN_UPVOTES_LOOSE = 1;
    const MIN_COMMENTS_LOOSE = 1;
    
    // Score each result for sorting
    const scored = results.map(r => {
      const thread = r.thread;
      const createdUtc = thread?.createdUtc || 0;
      const upvotes = thread?.score || 0;
      const comments = thread?.numComments || 0;
      
      // Recency score (0-3)
      let recencyScore = 0;
      if (createdUtc > ONE_YEAR_AGO) recencyScore = 3;
      else if (createdUtc > THREE_YEARS_AGO) recencyScore = 2;
      else if (createdUtc > 0) recencyScore = 1;
      // If no thread data (fetch failed), give benefit of doubt
      else if (!thread) recencyScore = 1.5;
      
      // Engagement score (0-3)
      let engagementScore = 0;
      if (upvotes >= 20 && comments >= 10) engagementScore = 3;
      else if (upvotes >= MIN_UPVOTES_STRICT && comments >= MIN_COMMENTS_STRICT) engagementScore = 2;
      else if (upvotes >= MIN_UPVOTES_LOOSE || comments >= MIN_COMMENTS_LOOSE) engagementScore = 1;
      // If no thread data, give benefit of doubt
      else if (!thread) engagementScore = 1;
      
      // Relevance bonus: title contains useful keywords (not just "question" posts)
      const title = (thread?.title || r.title || '').toLowerCase();
      const hasUsefulTitle = /best|recommend|favorite|top|where|good|great|hidden gem/i.test(title);
      const isJustQuestion = /^(where|what|anyone|has anyone|does anyone)\b/i.test(title) && !hasUsefulTitle;
      const relevanceBonus = hasUsefulTitle ? 1 : (isJustQuestion ? -0.5 : 0);
      
      const totalScore = recencyScore + engagementScore + relevanceBonus;
      
      return { result: r, recencyScore, engagementScore, totalScore, createdUtc, upvotes, comments };
    });
    
    // Sort by total score descending
    scored.sort((a, b) => b.totalScore - a.totalScore);
    
    // Try strict filter first: recent (< 3 years) AND decent engagement
    const strictFiltered = scored.filter(s => 
      s.recencyScore >= 2 && s.engagementScore >= 1
    );
    
    // If strict filter gives us at least 3 results, use it
    if (strictFiltered.length >= 3) {
      console.log(`[RedditAgent] Using strict filter: ${strictFiltered.length} quality results`);
      return strictFiltered.slice(0, 6).map(s => s.result);
    }
    
    // Fallback: looser filter - just need SOME signal of quality
    const looseFiltered = scored.filter(s => 
      s.totalScore >= 1.5 // At least some positive signals
    );
    
    if (looseFiltered.length >= 2) {
      console.log(`[RedditAgent] Using loose filter: ${looseFiltered.length} results`);
      return looseFiltered.slice(0, 6).map(s => s.result);
    }
    
    // Last resort: return top scored results regardless of filters
    console.log(`[RedditAgent] Filters too strict, returning top ${Math.min(5, scored.length)} by score`);
    return scored.slice(0, 5).map(s => s.result);
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

    // Build prompt with error history if available
    const errorContext = context.errorHistory 
      ? this.formatErrorHistoryForPrompt(context.errorHistory)
      : '';

    const prompt = REDDIT_EVAL_PROMPT
      .replace('{goal}', context.goal)
      .replace('{location}', context.location || 'Not specified')
      .replace('{results}', JSON.stringify(compactForPrompt, null, 2))
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

