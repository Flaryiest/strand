import { config } from '../../config.js';

export interface AgentResult {
  results: any[];
  iterations: number;
  hitLimit?: boolean;
  metadata?: {
    totalApiCalls: number;
    processingTime: number;
  };
}

export interface EvaluationResult {
  sufficient: boolean;
  score: number;
  gaps: string[];
  extracted: any[];
  refinement?: {
    action: string;
    params: Record<string, any>;
  };
}

export interface AgentContext {
  goal: string;
  location?: string;
  budget?: string;
  preferences?: string[];
  // Track URLs/places already fetched to avoid duplicates in subsequent searches
  seenUrls?: Set<string>;
  seenPlaceIds?: Set<string>;
  // Optional transparency emitter (kept loosely typed to avoid dependency cycles)
  transparency?: {
    thinking: (message: string, progress?: number) => Promise<void> | void;
    analyzing: (message: string, analysis?: any) => Promise<void> | void;
    deciding: (message: string, reasoning?: string) => Promise<void> | void;
    emitStep: (event: any) => Promise<void> | void;
  };
}

export abstract class BaseToolAgent {
  abstract name: string;
  abstract description: string;
  protected maxIterations = 3;
  protected model = 'gpt-5-mini'; // Cost-optimized reasoning model for evaluations
  protected reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' = 'low';
  protected verbosity: 'low' | 'medium' | 'high' = 'low';

  /**
   * Each agent implements its own search logic
   */
  protected abstract search(params: Record<string, any>): Promise<any[]>;

  /**
   * Each agent implements its own evaluation logic
   */
  protected abstract evaluateResults(
    results: any[],
    context: AgentContext
  ): Promise<EvaluationResult>;

  /**
   * Get the initial search parameters from context
   */
  protected abstract getInitialParams(context: AgentContext): Record<string, any> | Promise<Record<string, any>>;

  /**
   * Main execution loop with iterative refinement
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    let allResults: any[] = [];
    let iteration = 0;
    let totalApiCalls = 0;
    let params = await this.getInitialParams(context);

    console.log(`[${this.name}] Starting execution for goal: ${context.goal}`);

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`[${this.name}] Iteration ${iteration}/${this.maxIterations}`);

      try {
        // Perform search
        const newResults = await this.search(params);
        totalApiCalls++;
        allResults = this.mergeResults(allResults, newResults);

        console.log(`[${this.name}] Got ${newResults.length} new results, total: ${allResults.length}`);

        // Evaluate results
        const evaluation = await this.evaluateResults(allResults, context);
        totalApiCalls++; // LLM evaluation call

        console.log(`[${this.name}] Evaluation: sufficient=${evaluation.sufficient}, score=${evaluation.score}`);

        if (evaluation.sufficient) {
          return {
            results: evaluation.extracted,
            iterations: iteration,
            metadata: {
              totalApiCalls,
              processingTime: Date.now() - startTime
            }
          };
        }

        // If not sufficient and we have refinement suggestions, apply them
        if (evaluation.refinement) {
          console.log(`[${this.name}] Refining with: ${JSON.stringify(evaluation.refinement)}`);
          params = { ...params, ...evaluation.refinement.params };
        } else {
          // No refinement suggestions, exit loop
          console.log(`[${this.name}] No refinement suggestions, returning current results`);
          break;
        }
      } catch (error) {
        console.error(`[${this.name}] Error in iteration ${iteration}:`, error);
        // Continue to next iteration or return what we have
        if (allResults.length > 0) {
          break;
        }
        throw error;
      }
    }

    // Return what we have after all iterations
    return {
      results: allResults,
      iterations: iteration,
      hitLimit: iteration >= this.maxIterations,
      metadata: {
        totalApiCalls,
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Merge new results with existing results, avoiding duplicates
   */
  protected mergeResults(existing: any[], newResults: any[]): any[] {
    // Default implementation - can be overridden by subclasses
    const seen = new Set(existing.map(r => this.getResultKey(r)));
    const merged = [...existing];

    for (const result of newResults) {
      const key = this.getResultKey(result);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      }
    }

    return merged;
  }

  /**
   * Get a unique key for deduplication - override in subclasses
   */
  protected getResultKey(result: any): string {
    return JSON.stringify(result);
  }

  /**
   * Call LLM for evaluation using OpenAI Responses API (GPT-5.2 compatible)
   */
  protected async callLLM(prompt: string, modelOverride?: string): Promise<string> {
    const model = modelOverride || this.model;
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: model,
        input: prompt,
        reasoning: {
          effort: this.reasoningEffort
        },
        text: {
          verbosity: this.verbosity
        },
        max_output_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    
    // Responses API returns output in a different structure
    // The text output is in data.output (array of output items)
    if (data.output && Array.isArray(data.output)) {
      const textOutput = data.output.find((item: any) => item.type === 'message');
      if (textOutput?.content) {
        // Content can be an array of content blocks
        if (Array.isArray(textOutput.content)) {
          const textContent = textOutput.content.find((c: any) => c.type === 'output_text');
          return textContent?.text || '';
        }
        return textOutput.content;
      }
    }
    
    // Fallback for simpler response structure
    return data.output_text || data.text || '';
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks
   */
  protected parseJsonResponse<T>(response: string): T {
    // Remove markdown code blocks if present
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

