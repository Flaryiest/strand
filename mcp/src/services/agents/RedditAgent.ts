import { BaseToolAgent, AgentContext, EvaluationResult } from './BaseToolAgent.js';
import { REDDIT_EVAL_PROMPT } from '../../prompts/agentPrompts.js';
import { config } from '../../config.js';

interface RedditSearchResult {
  title: string;
  subreddit: string;
  url: string;
  selftext?: string;
  score: number;
  numComments: number;
  created: number;
  permalink: string;
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

  // City-specific subreddit mappings
  private subredditMap: Record<string, string[]> = {
    'san francisco': ['sanfrancisco', 'AskSF', 'foodsf', 'bayarea'],
    'sf': ['sanfrancisco', 'AskSF', 'foodsf', 'bayarea'],
    'new york': ['nyc', 'AskNYC', 'FoodNYC', 'newyorkcity'],
    'nyc': ['nyc', 'AskNYC', 'FoodNYC', 'newyorkcity'],
    'los angeles': ['LosAngeles', 'AskLosAngeles', 'FoodLosAngeles', 'LAlist'],
    'la': ['LosAngeles', 'AskLosAngeles', 'FoodLosAngeles'],
    'chicago': ['chicago', 'chicagofood', 'AskChicago'],
    'seattle': ['Seattle', 'SeattleWA', 'seattlefood'],
    'austin': ['Austin', 'austinfood', 'AskAustin'],
    'portland': ['Portland', 'askportland', 'portlandfood'],
    'denver': ['Denver', 'denverfood'],
    'boston': ['boston', 'bostonfoods'],
    'miami': ['Miami', 'miamifood'],
    'default': ['travel', 'solotravel', 'food', 'Foodies']
  };

  protected getInitialParams(context: AgentContext): Record<string, any> {
    // Find relevant subreddits based on location
    const subreddits = this.getSubredditsForLocation(context.location);
    
    return {
      query: context.goal,
      subreddits: subreddits.slice(0, 3), // Start with top 3
      sort: 'relevance',
      time: 'year' // Last year for recency
    };
  }

  private getSubredditsForLocation(location?: string): string[] {
    if (!location) return this.subredditMap['default'];

    const locationLower = location.toLowerCase();
    
    // Check for exact matches first
    for (const [key, subs] of Object.entries(this.subredditMap)) {
      if (locationLower.includes(key)) {
        return subs;
      }
    }

    // Default fallback
    return this.subredditMap['default'];
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
          // Only include actual Reddit links
          if (!item.link.includes('reddit.com')) continue;

          const subredditMatch = item.link.match(/reddit\.com\/r\/([^/]+)/);
          const extractedSubreddit = subredditMatch ? subredditMatch[1] : 'unknown';

          results.push({
            title: item.title,
            subreddit: extractedSubreddit,
            url: item.link,
            selftext: item.snippet,
            score: 0, // Not available from web search
            numComments: this.extractCommentCount(item.title, item.snippet),
            created: Date.now(),
            permalink: item.link.replace('https://www.reddit.com', '')
          });
        }
      } catch (error) {
        console.error(`[RedditAgent] Error searching ${subreddit}:`, error);
      }
    }

    console.log(`[RedditAgent] Found ${results.length} Reddit results`);
    return results;
  }

  private extractCommentCount(title: string, snippet: string): number {
    // Try to extract comment count from title/snippet if present
    const match = (title + snippet).match(/(\d+)\s*comments?/i);
    return match ? parseInt(match[1]) : 0;
  }

  protected async evaluateResults(
    results: RedditSearchResult[],
    context: AgentContext
  ): Promise<EvaluationResult> {
    if (results.length === 0) {
      // Try different subreddits
      const newSubreddits = this.getSubredditsForLocation(context.location);
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

    const prompt = REDDIT_EVAL_PROMPT
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
    return results.slice(0, 8).map(r => ({
      title: r.title,
      subreddit: r.subreddit,
      url: r.url,
      upvotes: r.score,
      commentCount: r.numComments,
      topRecommendations: [],
      keyInsights: [r.selftext?.slice(0, 200) || '']
    }));
  }

  protected getResultKey(result: RedditSearchResult): string {
    return result.url;
  }
}

