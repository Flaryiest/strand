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
}

export class RedditAgent extends BaseToolAgent {
  name = 'reddit_agent';
  description = 'Searches Reddit for authentic local recommendations and discussions';
  protected maxIterations = 3;

  // Cache for AI-determined subreddits to avoid repeated calls
  private subredditCache = new Map<string, string[]>();

  protected async getInitialParams(context: AgentContext): Promise<Record<string, any>> {
    // Find relevant subreddits based on location using AI
    const subreddits = await this.getSubredditsForLocation(context.location, context.goal);
    
    return {
      query: context.goal,
      subreddits: subreddits.slice(0, 3), // Start with top 3
      sort: 'relevance',
      time: 'year' // Last year for recency
    };
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
      const prompt = `You are a Reddit expert. Given a location and search goal, suggest the most relevant subreddits to search for local recommendations.

Location: ${location}
Goal: ${goal || 'local recommendations'}

Return a JSON array of 4-6 subreddit names (without the r/ prefix) that would be most useful for finding local recommendations in this area. Consider:
1. City/region-specific subreddits (e.g., "Seattle", "bayarea", "toronto")
2. Local food subreddits (e.g., "seattlefood", "FoodNYC") 
3. Local ask subreddits (e.g., "AskNYC", "AskSF", "askTO")
4. Activity-specific subreddits if relevant to the goal
5. General fallbacks like "travel" or "food" if no local subs exist

Only return the JSON array, no other text. Example: ["Seattle", "SeattleWA", "seattlefood", "AskSeattle"]`;

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

  protected async search(params: RedditSearchParams): Promise<RedditSearchResult[]> {
    // Use web search with site:reddit.com as a fallback
    // Reddit's official API requires OAuth which is complex for this use case
    if (!config.serperApiKey) {
      console.warn('[RedditAgent] Serper API key not configured, cannot search Reddit');
      return [];
    }

    const results: RedditSearchResult[] = [];

    // Search across specified subreddits
    for (const subreddit of params.subreddits || ['all']) {
      const query = subreddit === 'all' 
        ? `${params.query} site:reddit.com`
        : `${params.query} site:reddit.com/r/${subreddit}`;

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
            num: 10
          })
        });

        if (!response.ok) {
          console.error(`[RedditAgent] Serper error: ${response.status}`);
          continue;
        }

        const data: any = await response.json();

        // Transform results
        for (const item of data.organic || []) {
          if (!item.link?.includes('reddit.com')) continue;

          const subredditMatch = item.link.match(/reddit\.com\/r\/([^/]+)/);
          const extractedSubreddit = subredditMatch ? subredditMatch[1] : 'unknown';

          results.push({
            title: item.title,
            subreddit: extractedSubreddit,
            url: item.link,
            snippet: item.snippet
          });
        }
      } catch (error) {
        console.error(`[RedditAgent] Error searching ${subreddit}:`, error);
      }
    }

    // Dedupe by URL and then fetch thread JSON for top N threads.
    const seen = new Set<string>();
    const deduped = results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const maxThreads = 3;
    for (const r of deduped.slice(0, maxThreads)) {
      try {
        r.thread = await fetchRedditThread(r.url, { maxComments: 25 });
      } catch (e) {
        r.threadError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    console.log(`[RedditAgent] Found ${deduped.length} Reddit results`);
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

