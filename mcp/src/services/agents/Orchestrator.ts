import { config } from '../../config.js';
import { PlacesAgent } from './PlacesAgent.js';
import { WebSearchAgent } from './WebSearchAgent.js';
import { RedditAgent } from './RedditAgent.js';
import { BaseToolAgent, AgentResult, AgentContext } from './BaseToolAgent.js';
import { TransparencyLayer } from '../ai/TransparencyLayer.js';
import {
  ORCHESTRATOR_PLANNING_PROMPT,
  ORCHESTRATOR_EVAL_PROMPT,
  SYNTHESIS_PROMPT,
  ITINERARY_SYNTHESIS_PROMPT
} from '../../prompts/agentPrompts.js';

interface AgentPlan {
  name: string;
  goal: string;
  priority: number;
  params: Record<string, any>;
}

interface ExecutionPlan {
  reasoning: string;
  agents: AgentPlan[];
}

interface CombinedResults {
  places: AgentResult | null;
  web: AgentResult | null;
  reddit: AgentResult | null;
}

interface OrchestratorOptions {
  query: string;
  location?: string;
  budget?: string;
  preferences?: string[];
  transparency?: TransparencyLayer;
}

// Itinerary types matching frontend expectations
interface PlaceRecommendation {
  id: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  types: string[];
  photoUrl?: string | null;
  googleMapsUrl?: string;
  reason: string;
  highlights?: string[];
  bestFor?: string;
  location?: { lat: number; lng: number };
}

interface RecommendationSlot {
  slotId: string;
  slotLabel: string;
  slotIcon?: string;
  timeEstimate?: string | null;
  primary: PlaceRecommendation;
  alternatives: PlaceRecommendation[];
  selectedIndex?: number;
}

interface ItineraryData {
  id: string;
  summary: string;
  totalEstimatedTime?: string;
  totalEstimatedCost?: string;
  slots: RecommendationSlot[];
  generatedAt: string;
}

interface SynthesizedResult {
  response: string;
  itinerary?: ItineraryData;
  topRecommendations: any[];
  metadata: {
    agentsUsed: string[];
    totalIterations: number;
    processingTime: number;
    confidence: number;
  };
}

export class Orchestrator {
  private agents: Map<string, BaseToolAgent>;
  private maxRounds = 2;
  private model = 'gpt-5.2'; // Best general-purpose model for orchestration
  private miniModel = 'gpt-5-mini'; // Cost-optimized model for evaluation
  private reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' = 'medium';
  private verbosity: 'low' | 'medium' | 'high' = 'medium';

  constructor() {
    this.agents = new Map<string, BaseToolAgent>();
    this.agents.set('places_agent', new PlacesAgent());
    this.agents.set('web_agent', new WebSearchAgent());
    this.agents.set('reddit_agent', new RedditAgent());
  }

  /**
   * Main orchestration flow
   */
  async process(options: OrchestratorOptions): Promise<SynthesizedResult> {
    const startTime = Date.now();
    const { query, location, budget, preferences, transparency } = options;

    // Initialize shared caches to prevent duplicate results across agent calls
    const seenUrls = new Set<string>();
    const seenPlaceIds = new Set<string>();

    const context: AgentContext = {
      goal: query,
      location,
      budget,
      preferences,
      seenUrls,
      seenPlaceIds
    };

    // Phase 1: Create execution plan - let AI generate the opening message
    const plan = await this.createPlan(query, location, budget);
    console.log('[Orchestrator] Plan created:', JSON.stringify(plan, null, 2));

    // Use AI-generated thinking message or fall back to generic
    const thinkingMessage = (plan as any).thinkingMessage || `Looking into ${query}...`;
    transparency?.thinking(thinkingMessage);

    // Show the AI's search strategy with specific details
    const searchFocus = (plan as any).searchFocus || [];
    const agentDetails = plan.agents.map((a: any) => ({
      name: a.name,
      lookingFor: a.lookingFor || a.goal
    }));
    
    transparency?.analyzing(plan.reasoning, {
      searchFocus,
      agents: agentDetails
    });

    // Phase 2: Execute agents in parallel - show what each agent is looking for
    const searchDescription = plan.agents
      .map((a: any) => a.lookingFor || a.goal)
      .filter(Boolean)
      .slice(0, 2)
      .join(', then ');
    transparency?.thinking(searchDescription ? `Searching for ${searchDescription}...` : 'Gathering information from multiple sources...');
    
    let results = await this.executeAgentsParallel(plan.agents, context, transparency);

    // Phase 3: Evaluate combined results and potentially request more
    let round = 0;
    let confidence = 0;
    let topRecommendations: any[] = [];
    let lastEvaluation: any = null;

    while (round < this.maxRounds) {
      round++;

      const evaluation = await this.evaluateCombinedResults(query, location, results);
      lastEvaluation = evaluation;
      confidence = evaluation.confidence;
      topRecommendations = evaluation.topRecommendations;

      // Use AI-generated analysis message with specific findings
      const analysisMessage = evaluation.analysisMessage || 'Looking at what I found...';
      const interestingFindings = evaluation.interestingFindings || [];
      
      transparency?.analyzing(analysisMessage, {
        sufficient: evaluation.sufficient,
        confidence: evaluation.confidence,
        interestingFindings,
        topPicks: (evaluation.topRecommendations || []).slice(0, 3).map((r: any) => ({
          name: r?.name,
          whyPicked: r?.whyPicked || r?.highlights?.[0]
        })),
        gaps: evaluation.gaps
      });

      console.log(`[Orchestrator] Round ${round} evaluation:`, {
        sufficient: evaluation.sufficient,
        confidence: evaluation.confidence,
        gaps: evaluation.gaps
      });

      if (evaluation.sufficient) {
        // Generate a specific deciding message based on what was found
        const topPick = evaluation.topRecommendations?.[0];
        const decidingMessage = topPick 
          ? `${topPick.name} is standing out - ${topPick.whyPicked || 'strong reviews across sources'}. Let me put together the full picture...`
          : 'I have a good sense of the options now. Let me organize my recommendations...';
        transparency?.deciding(decidingMessage, analysisMessage);
        break;
      }

      // Request additional searches if needed
      if (evaluation.additionalQueries && evaluation.additionalQueries.length > 0) {
        // Use AI-generated message about what more is needed
        const needsMoreMessage = evaluation.needsMoreMessage || 'Looking for more information...';
        transparency?.thinking(needsMoreMessage);
        
        const additionalPlans = evaluation.additionalQueries.map((q: any) => ({
          name: q.agent,
          goal: q.goal,
          priority: 1,
          params: q.params || {}
        }));

        const additionalResults = await this.executeAgentsParallel(
          additionalPlans,
          { ...context, goal: evaluation.additionalQueries[0]?.goal || context.goal },
          transparency
        );

        results = this.mergeResults(results, additionalResults);
      } else {
        break;
      }
    }

    // Phase 4: Synthesize final response with structured itinerary
    // Generate a contextual final message based on what we found
    const topPick = lastEvaluation?.topRecommendations?.[0];
    const finalThinkingMessage = topPick
      ? `Alright, ${topPick.name} is my top pick. Working out the details...`
      : 'Pulling together the best options I found...';
    transparency?.deciding(finalThinkingMessage, lastEvaluation?.analysisMessage || 'Analyzing the data...');
    
    // Generate both structured itinerary and text summary
    const { response, itinerary } = await this.synthesizeWithItinerary(
      query, 
      location, 
      results, 
      topRecommendations,
      transparency
    );

    const totalIterations = 
      (results.places?.iterations || 0) +
      (results.web?.iterations || 0) +
      (results.reddit?.iterations || 0);

    return {
      response,
      itinerary,
      topRecommendations,
      metadata: {
        agentsUsed: Object.keys(results).filter(k => (results as any)[k] !== null),
        totalIterations,
        processingTime: Date.now() - startTime,
        confidence
      }
    };
  }

  /**
   * Create an execution plan based on the query
   */
  private async createPlan(
    query: string,
    location?: string,
    budget?: string
  ): Promise<ExecutionPlan> {
    const constraints = [];
    if (budget) constraints.push(`Budget: ${budget}`);
    if (location) constraints.push(`Location: ${location}`);

    const prompt = ORCHESTRATOR_PLANNING_PROMPT
      .replace('{query}', query)
      .replace('{location}', location || 'Not specified')
      .replace('{constraints}', constraints.join(', ') || 'None specified');

    try {
      const response = await this.callLLM(prompt, this.miniModel);
      return this.parseJsonResponse<ExecutionPlan>(response);
    } catch (error) {
      console.error('[Orchestrator] Planning error:', error);
      // Default plan: use all agents
      return {
        reasoning: 'Using default plan due to planning error',
        agents: [
          { name: 'places_agent', goal: query, priority: 1, params: {} },
          { name: 'web_agent', goal: query, priority: 2, params: {} },
          { name: 'reddit_agent', goal: query, priority: 3, params: {} }
        ]
      };
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  private async executeAgentsParallel(
    plans: AgentPlan[],
    context: AgentContext,
    transparency?: TransparencyLayer
  ): Promise<CombinedResults> {
    const results: CombinedResults = {
      places: null,
      web: null,
      reddit: null
    };

    const executions = plans.map(async (plan) => {
      const agent = this.agents.get(plan.name);
      if (!agent) {
        console.warn(`[Orchestrator] Unknown agent: ${plan.name}`);
        return null;
      }

      const agentContext: AgentContext = {
        ...context,
        goal: plan.goal,
        // Optional pass-through for agents that want to emit high-level transparency.
        transparency: transparency as any
      };

      const narrativeMessages: Record<string, string> = {
        'places_agent': `Searching Google Maps for relevant places...`,
        'web_agent': `Looking through travel blogs and review sites for insights...`,
        'reddit_agent': `Checking Reddit for local recommendations and honest opinions...`
      };

      transparency?.emitStep({
        type: 'action',
        data: {
          message: narrativeMessages[plan.name] || `Searching ${this.getAgentDisplayName(plan.name)}...`,
          action: plan.name,
          params: { goal: plan.goal }
        }
      });

      try {
        const result = await agent.execute(agentContext);

        const summary = this.summarizeAgentResult(plan.name, result?.results || []);
        const count = result.results.length;
        
        const resultMessages: Record<string, string> = {
          'places_agent': count === 0 
            ? 'No new places were found'
            : `Found ${count} places with ratings and reviews`,
          'web_agent': count === 0
            ? 'No new articles were found'
            : `Found ${count} articles and reviews to analyze`,
          'reddit_agent': count === 0
            ? 'No new discussions were found'
            : `Found ${count} Reddit discussions with local insights`
        };

        transparency?.emitStep({
          type: 'data',
          data: {
            action: plan.name,
            message: resultMessages[plan.name] || `Found ${result.results.length} results from ${this.getAgentDisplayName(plan.name)}`,
            results: { count: result.results.length, iterations: result.iterations, summary }
          }
        });

        return { name: plan.name, result };
      } catch (error) {
        console.error(`[Orchestrator] Agent ${plan.name} failed:`, error);
        return { name: plan.name, result: null };
      }
    });

    const settled = await Promise.all(executions);

    for (const item of settled) {
      if (!item) continue;
      
      switch (item.name) {
        case 'places_agent':
          results.places = item.result;
          break;
        case 'web_agent':
          results.web = item.result;
          break;
        case 'reddit_agent':
          results.reddit = item.result;
          break;
      }
    }

    return results;
  }

  private summarizeAgentResult(agentName: string, results: any[]): any {
    try {
      if (agentName === 'places_agent') {
        return {
          topPlaces: results.slice(0, 5).map((p: any) => ({
            name: p?.name,
            rating: p?.rating,
            priceLevel: p?.priceLevel
          }))
        };
      }

      if (agentName === 'web_agent') {
        const domains = results
          .map((r: any) => r?.source)
          .filter(Boolean);
        const uniqueDomains = Array.from(new Set(domains)).slice(0, 8);
        const withContent = results.filter((r: any) => r?.content?.text).length;
        return {
          sources: uniqueDomains,
          extractedContentCount: withContent,
          sampleUrls: results.slice(0, 3).map((r: any) => r?.url).filter(Boolean)
        };
      }

      if (agentName === 'reddit_agent') {
        const subreddits = results
          .map((r: any) => r?.thread?.subreddit || r?.subreddit)
          .filter(Boolean);
        const uniqueSubs = Array.from(new Set(subreddits)).slice(0, 8);
        const threadsFetched = results.filter((r: any) => r?.thread?.comments?.length).length;
        
        // Include thread URL with each sample comment for linking
        const sampleComments = results
          .filter((r: any) => r?.thread?.comments?.length > 0)
          .slice(0, 3)
          .map((r: any) => {
            const comment = r.thread.comments[0];
            return {
              author: comment?.author,
              score: comment?.score,
              body: comment?.body?.slice(0, 200),
              threadUrl: r.url,
              threadTitle: r.thread?.title || r.title
            };
          });
        return {
          subreddits: uniqueSubs,
          threadsFetched,
          sampleComments,
          // Also include thread URLs directly
          threadUrls: results.slice(0, 5).map((r: any) => ({
            url: r.url,
            title: r.thread?.title || r.title,
            subreddit: r.thread?.subreddit || r.subreddit
          })).filter((t: any) => t.url)
        };
      }
    } catch {
      // ignore
    }
    return { sample: results.slice(0, 3) };
  }

  private getAgentDisplayName(name: string): string {
    const names: Record<string, string> = {
      'places_agent': 'Google Places',
      'web_agent': 'Web Search',
      'reddit_agent': 'Reddit'
    };
    return names[name] || name;
  }

  /**
   * Evaluate combined results from all agents
   */
  private async evaluateCombinedResults(
    query: string,
    location: string | undefined,
    results: CombinedResults
  ): Promise<{
    sufficient: boolean;
    confidence: number;
    topRecommendations: any[];
    gaps: string[];
    additionalQueries?: any[];
    analysisMessage?: string;
    interestingFindings?: string[];
    needsMoreMessage?: string;
  }> {
    const placesForPrompt = (results.places?.results || []).slice(0, 10);

    const webForPrompt = (results.web?.results || []).slice(0, 8).map((r: any) => ({
      title: r?.title,
      url: r?.url,
      snippet: r?.snippet,
      source: r?.source,
      date: r?.date,
      excerpts: r?.content?.excerpts,
      contentError: r?.contentError
    }));

    const redditForPrompt = (results.reddit?.results || []).slice(0, 8).map((r: any) => ({
      title: r?.thread?.title || r?.title,
      subreddit: r?.thread?.subreddit || r?.subreddit,
      url: r?.url,
      upvotes: r?.thread?.score || 0,
      commentCount: r?.thread?.numComments || 0,
      postExcerpt: (r?.thread?.selftext || r?.snippet || '').slice(0, 400),
      topComments: (r?.thread?.comments || []).slice(0, 6).map((c: any) => ({
        author: c?.author,
        score: c?.score,
        body: String(c?.body || '').slice(0, 280)
      })),
      threadError: r?.threadError
    }));

    const prompt = ORCHESTRATOR_EVAL_PROMPT
      .replace('{query}', query)
      .replace('{location}', location || 'Not specified')
      .replace('{placesResults}', JSON.stringify(placesForPrompt, null, 2))
      .replace('{webResults}', JSON.stringify(webForPrompt, null, 2))
      .replace('{redditResults}', JSON.stringify(redditForPrompt, null, 2));

    try {
      const response = await this.callLLM(prompt, this.miniModel);
      return this.parseJsonResponse(response);
    } catch (error) {
      console.error('[Orchestrator] Evaluation error:', error);
      // Fallback: consider sufficient if we have places results
      return {
        sufficient: (results.places?.results?.length || 0) >= 3,
        confidence: 5,
        topRecommendations: results.places?.results?.slice(0, 5) || [],
        gaps: ['Evaluation failed']
      };
    }
  }

  /**
   * Merge additional results into existing results
   */
  private mergeResults(
    existing: CombinedResults,
    additional: CombinedResults
  ): CombinedResults {
    return {
      places: this.mergeAgentResults(existing.places, additional.places),
      web: this.mergeAgentResults(existing.web, additional.web),
      reddit: this.mergeAgentResults(existing.reddit, additional.reddit)
    };
  }

  private mergeAgentResults(
    existing: AgentResult | null,
    additional: AgentResult | null
  ): AgentResult | null {
    if (!additional) return existing;
    if (!existing) return additional;

    return {
      results: [...existing.results, ...additional.results],
      iterations: existing.iterations + additional.iterations,
      hitLimit: existing.hitLimit || additional.hitLimit,
      metadata: {
        totalApiCalls: 
          (existing.metadata?.totalApiCalls || 0) + 
          (additional.metadata?.totalApiCalls || 0),
        processingTime:
          (existing.metadata?.processingTime || 0) +
          (additional.metadata?.processingTime || 0)
      }
    };
  }

  /**
   * Synthesize final response with structured itinerary data
   */
  private async synthesizeWithItinerary(
    query: string,
    location: string | undefined,
    results: CombinedResults,
    topRecommendations: any[],
    transparency?: TransparencyLayer
  ): Promise<{ response: string; itinerary?: ItineraryData }> {
    // Prepare aggregated data with full place details for itinerary generation
    const webEvidence = (results.web?.results || []).slice(0, 5).map((r: any) => ({
      title: r?.title,
      url: r?.url,
      source: r?.source,
      snippet: r?.snippet,
      date: r?.date,
      excerpts: r?.content?.excerpts,
      contentError: r?.contentError
    }));

    const redditEvidence = (results.reddit?.results || []).slice(0, 5).map((r: any) => ({
      title: r?.thread?.title || r?.title,
      url: r?.url,
      subreddit: r?.thread?.subreddit || r?.subreddit,
      upvotes: r?.thread?.score || 0,
      commentCount: r?.thread?.numComments || 0,
      postExcerpt: (r?.thread?.selftext || r?.snippet || '').slice(0, 500),
      topComments: (r?.thread?.comments || []).slice(0, 6).map((c: any) => ({
        author: c?.author,
        score: c?.score,
        body: String(c?.body || '').slice(0, 320)
      })),
      threadError: r?.threadError
    }));

    const aggregatedData = {
      placesCount: results.places?.results?.length || 0,
      webArticles: webEvidence,
      redditThreads: redditEvidence,
      placesHighlights: results.places?.results?.slice(0, 10).map((p: any) => ({
        name: p.name,
        rating: p.rating,
        reviewCount: p.userRatingsTotal,
        address: p.address,
        priceLevel: p.priceLevel,
        types: p.types,
        placeId: p.placeId,
        location: p.location,
        photoUrl: p.photoUrl
      })) || []
    };

    // Try to generate structured itinerary
    let itinerary: ItineraryData | undefined;
    
    try {
      const itineraryPrompt = ITINERARY_SYNTHESIS_PROMPT
        .replace('{query}', query)
        .replace('{location}', location || 'your area')
        .replace('{aggregatedData}', JSON.stringify(aggregatedData, null, 2))
        .replace('{topRecommendations}', JSON.stringify(topRecommendations, null, 2));

      const itineraryResponse = await this.callLLM(itineraryPrompt, this.model);
      const parsedItinerary = this.parseJsonResponse<Omit<ItineraryData, 'id' | 'generatedAt'>>(itineraryResponse);
      
      // Add metadata
      itinerary = {
        ...parsedItinerary,
        id: `itin-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        slots: parsedItinerary.slots.map(slot => ({
          ...slot,
          selectedIndex: 0, // Default to primary selection
          // Ensure photoUrl is preserved from original places data
          primary: this.enrichPlaceWithPhoto(slot.primary, aggregatedData.placesHighlights),
          alternatives: (slot.alternatives || []).map(alt => 
            this.enrichPlaceWithPhoto(alt, aggregatedData.placesHighlights)
          )
        }))
      };

      console.log('[Orchestrator] Generated itinerary with', itinerary.slots.length, 'slots');

      transparency?.analyzing('Here\'s what I\'ve put together for you', {
        slots: itinerary.slots.map(s => ({
          slotLabel: s.slotLabel,
          primary: s.primary?.name,
          alternatives: (s.alternatives || []).map(a => a?.name).filter(Boolean)
        }))
      });
    } catch (error) {
      console.error('[Orchestrator] Itinerary generation error:', error);
      // Continue without structured itinerary
    }

    // Generate text summary (always, as fallback/supplement)
    let response: string;
    try {
      const textPrompt = SYNTHESIS_PROMPT
        .replace('{query}', query)
        .replace('{location}', location || 'your area')
        .replace('{aggregatedData}', JSON.stringify(aggregatedData, null, 2))
        .replace('{topRecommendations}', JSON.stringify(topRecommendations, null, 2));

      response = await this.callLLM(textPrompt, this.model);
    } catch (error) {
      console.error('[Orchestrator] Text synthesis error:', error);
      response = this.generateFallbackResponse(topRecommendations);
    }

    return { response, itinerary };
  }

  /**
   * Enrich a place recommendation with photoUrl from original places data
   * This ensures photoUrl is preserved even if the LLM doesn't copy it correctly
   */
  private enrichPlaceWithPhoto(place: PlaceRecommendation, placesHighlights: any[]): PlaceRecommendation {
    if (!place) return place;
    
    // If place already has a valid photoUrl, keep it
    if (place.photoUrl && place.photoUrl.startsWith('http')) {
      return place;
    }
    
    // Try to find matching place in original data by name (case-insensitive partial match)
    const normalizedName = place.name?.toLowerCase().trim();
    const matchingPlace = placesHighlights.find(p => {
      const pName = p.name?.toLowerCase().trim();
      return pName === normalizedName || 
             pName?.includes(normalizedName) || 
             normalizedName?.includes(pName);
    });
    
    if (matchingPlace?.photoUrl) {
      console.log(`[Orchestrator] Enriched "${place.name}" with photoUrl from places data`);
      return {
        ...place,
        photoUrl: matchingPlace.photoUrl,
        // Also ensure location is preserved
        location: place.location || matchingPlace.location
      };
    }
    
    return place;
  }

  private generateFallbackResponse(recommendations: any[]): string {
    if (recommendations.length === 0) {
      return "I couldn't find specific recommendations for your query. Could you try being more specific about what you're looking for?";
    }

    const topRec = recommendations[0];
    return `I found some interesting options for you. ${topRec.name} stands out with strong reviews. Here's what I've put together:`;
  }

  /**
   * Call LLM with specified model using OpenAI Responses API (GPT-5.2 compatible)
   */
  private async callLLM(prompt: string, model: string = this.model): Promise<string> {
    // Use lower reasoning for mini model, higher for main model
    const isMini = model.includes('mini');
    const effort = isMini ? 'low' : this.reasoningEffort;
    const verb = isMini ? 'low' : this.verbosity;
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        reasoning: {
          effort: effort
        },
        text: {
          verbosity: verb
        },
        max_output_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    
    // Responses API returns output in a different structure
    if (data.output && Array.isArray(data.output)) {
      const textOutput = data.output.find((item: any) => item.type === 'message');
      if (textOutput?.content) {
        if (Array.isArray(textOutput.content)) {
          const textContent = textOutput.content.find((c: any) => c.type === 'output_text');
          return textContent?.text || '';
        }
        return textOutput.content;
      }
    }
    
    return data.output_text || data.text || '';
  }

  /**
   * Parse JSON from LLM response
   */
  private parseJsonResponse<T>(response: string): T {
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return JSON.parse(cleaned.trim());
  }
}

