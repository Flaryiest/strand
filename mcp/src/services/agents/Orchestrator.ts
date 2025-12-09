import { config } from '../../config.js';
import { PlacesAgent } from './PlacesAgent.js';
import { WebSearchAgent } from './WebSearchAgent.js';
import { RedditAgent } from './RedditAgent.js';
import { BaseToolAgent, AgentResult, AgentContext } from './BaseToolAgent.js';
import { TransparencyLayer } from '../ai/TransparencyLayer.js';
import {
  ORCHESTRATOR_PLANNING_PROMPT,
  ORCHESTRATOR_EVAL_PROMPT,
  SYNTHESIS_PROMPT
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

interface SynthesizedResult {
  response: string;
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
  private model = 'gpt-4o'; // Use better model for orchestration
  private miniModel = 'gpt-4o-mini'; // Cheaper model for evaluation

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

    const context: AgentContext = {
      goal: query,
      location,
      budget,
      preferences
    };

    transparency?.thinking('Analyzing your request and planning the search strategy...');

    // Phase 1: Create execution plan
    const plan = await this.createPlan(query, location, budget);
    console.log('[Orchestrator] Plan created:', JSON.stringify(plan, null, 2));

    transparency?.analyzing('Planning complete', {
      reasoning: plan.reasoning,
      agents: plan.agents.map(a => a.name)
    });

    // Phase 2: Execute agents in parallel
    transparency?.thinking(`Searching ${plan.agents.length} data sources in parallel...`);
    let results = await this.executeAgentsParallel(plan.agents, context, transparency);

    // Phase 3: Evaluate combined results and potentially request more
    let round = 0;
    let confidence = 0;
    let topRecommendations: any[] = [];

    while (round < this.maxRounds) {
      round++;
      transparency?.analyzing(`Evaluating results (round ${round}/${this.maxRounds})...`);

      const evaluation = await this.evaluateCombinedResults(query, location, results);
      confidence = evaluation.confidence;
      topRecommendations = evaluation.topRecommendations;

      console.log(`[Orchestrator] Round ${round} evaluation:`, {
        sufficient: evaluation.sufficient,
        confidence: evaluation.confidence,
        gaps: evaluation.gaps
      });

      if (evaluation.sufficient) {
        transparency?.deciding('Data collection complete, synthesizing recommendations...');
        break;
      }

      // Request additional searches if needed
      if (evaluation.additionalQueries && evaluation.additionalQueries.length > 0) {
        transparency?.thinking('Gathering additional information...');
        
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

    // Phase 4: Synthesize final response
    transparency?.deciding('Creating your personalized recommendations...');
    const response = await this.synthesize(query, location, results, topRecommendations);

    const totalIterations = 
      (results.places?.iterations || 0) +
      (results.web?.iterations || 0) +
      (results.reddit?.iterations || 0);

    return {
      response,
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
        goal: plan.goal
      };

      transparency?.emitStep({
        type: 'action',
        data: {
          message: `Searching ${this.getAgentDisplayName(plan.name)}...`,
          action: plan.name,
          params: { goal: plan.goal }
        }
      });

      try {
        const result = await agent.execute(agentContext);
        
        transparency?.emitStep({
          type: 'data',
          data: {
            message: `Found ${result.results.length} results from ${this.getAgentDisplayName(plan.name)}`,
            results: { count: result.results.length, iterations: result.iterations }
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
  }> {
    const prompt = ORCHESTRATOR_EVAL_PROMPT
      .replace('{query}', query)
      .replace('{location}', location || 'Not specified')
      .replace('{placesResults}', JSON.stringify(results.places?.results?.slice(0, 10) || [], null, 2))
      .replace('{webResults}', JSON.stringify(results.web?.results?.slice(0, 8) || [], null, 2))
      .replace('{redditResults}', JSON.stringify(results.reddit?.results?.slice(0, 8) || [], null, 2));

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
   * Synthesize final response from all gathered data
   */
  private async synthesize(
    query: string,
    location: string | undefined,
    results: CombinedResults,
    topRecommendations: any[]
  ): Promise<string> {
    // Prepare aggregated data summary
    const aggregatedData = {
      placesCount: results.places?.results?.length || 0,
      webArticles: results.web?.results?.slice(0, 5) || [],
      redditThreads: results.reddit?.results?.slice(0, 5) || [],
      placesHighlights: results.places?.results?.slice(0, 5).map((p: any) => ({
        name: p.name,
        rating: p.rating,
        address: p.address,
        priceLevel: p.priceLevel
      })) || []
    };

    const prompt = SYNTHESIS_PROMPT
      .replace('{query}', query)
      .replace('{location}', location || 'your area')
      .replace('{aggregatedData}', JSON.stringify(aggregatedData, null, 2))
      .replace('{topRecommendations}', JSON.stringify(topRecommendations, null, 2));

    try {
      const response = await this.callLLM(prompt, this.model);
      return response;
    } catch (error) {
      console.error('[Orchestrator] Synthesis error:', error);
      // Fallback: return a basic response
      return this.generateFallbackResponse(topRecommendations);
    }
  }

  private generateFallbackResponse(recommendations: any[]): string {
    if (recommendations.length === 0) {
      return "I couldn't find specific recommendations for your query. Could you try being more specific about what you're looking for?";
    }

    let response = "## Top Recommendations\n\n";
    for (let i = 0; i < Math.min(3, recommendations.length); i++) {
      const rec = recommendations[i];
      response += `**${i + 1}. ${rec.name}**\n`;
      if (rec.address) response += `📍 ${rec.address}\n`;
      if (rec.rating) response += `⭐ ${rec.rating}/5\n`;
      response += '\n';
    }
    return response;
  }

  /**
   * Call LLM with specified model
   */
  private async callLLM(prompt: string, model: string = this.model): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    return data.choices[0]?.message?.content || '';
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

