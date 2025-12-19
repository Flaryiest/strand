import { config } from '../../config.js';

export interface AgentResult {
  results: any[];
  iterations: number;
  hitLimit?: boolean;
  metadata?: {
    totalApiCalls: number;
    processingTime: number;
    errors?: ErrorRecord[];
    earlyExit?: boolean;
  };
}

export interface ErrorRecord {
  iteration: number;
  phase: 'search' | 'evaluation' | 'refinement';
  message: string;
  recoverable: boolean;
  timestamp: string;
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
  // Error history from previous iterations for adaptive behavior
  errorHistory?: ErrorRecord[];
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
  protected model = 'gpt-5-nano'; // Cost-optimized reasoning model for evaluations
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
   * Heuristic check to see if results are "clearly good" and we can skip LLM eval.
   * Override in subclasses for agent-specific logic.
   * Returns extracted results if early exit, null otherwise.
   */
  protected checkEarlyExit(results: any[], context: AgentContext): any[] | null {
    // Default: no early exit, always do LLM eval
    // Subclasses override this with their own heuristics
    return null;
  }

  /**
   * Main execution loop with iterative refinement and error feedback
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    let allResults: any[] = [];
    let iteration = 0;
    let totalApiCalls = 0;
    let params = await this.getInitialParams(context);
    const errorHistory: ErrorRecord[] = [];

    console.log(`[${this.name}] Starting execution for goal: ${context.goal}`);

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`[${this.name}] Iteration ${iteration}/${this.maxIterations}`);

      // Search phase
      let newResults: any[] = [];
      try {
        newResults = await this.search(params);
        totalApiCalls++;
        allResults = this.mergeResults(allResults, newResults);
        console.log(`[${this.name}] Got ${newResults.length} new results, total: ${allResults.length}`);
      } catch (error) {
        const errorRecord = this.recordError(error, iteration, 'search');
        errorHistory.push(errorRecord);
        console.error(`[${this.name}] Search error in iteration ${iteration}:`, error);
        
        // If we have some results, continue to evaluation with error context
        // Otherwise, try to recover with modified params
        if (allResults.length === 0 && iteration < this.maxIterations) {
          params = this.adjustParamsAfterError(params, errorRecord);
          continue;
        }
      }

      // EARLY EXIT CHECK: If results are clearly good, skip LLM eval
      const earlyExitResults = this.checkEarlyExit(allResults, context);
      if (earlyExitResults !== null) {
        console.log(`[${this.name}] Early exit: results passed heuristic check, skipping LLM eval`);
        return {
          results: earlyExitResults,
          iterations: iteration,
          metadata: {
            totalApiCalls,
            processingTime: Date.now() - startTime,
            earlyExit: true
          }
        };
      }

      // Evaluation phase - pass error history for adaptive behavior
      try {
        const contextWithErrors: AgentContext = {
          ...context,
          errorHistory: errorHistory.length > 0 ? errorHistory : undefined
        };
        
        const evaluation = await this.evaluateResults(allResults, contextWithErrors);
        totalApiCalls++; // LLM evaluation call

        console.log(`[${this.name}] Evaluation: sufficient=${evaluation.sufficient}, score=${evaluation.score}`);

        if (evaluation.sufficient) {
          return {
            results: evaluation.extracted,
            iterations: iteration,
            metadata: {
              totalApiCalls,
              processingTime: Date.now() - startTime,
              errors: errorHistory.length > 0 ? errorHistory : undefined
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
        const errorRecord = this.recordError(error, iteration, 'evaluation');
        errorHistory.push(errorRecord);
        console.error(`[${this.name}] Evaluation error in iteration ${iteration}:`, error);
        
        // If evaluation fails but we have results, try to continue or return what we have
        if (allResults.length > 0) {
          // If this is the last iteration, break and return results
          if (iteration >= this.maxIterations) {
            break;
          }
          // Otherwise, try expanding search with adjusted params
          params = this.adjustParamsAfterError(params, errorRecord);
        } else if (!errorRecord.recoverable) {
          throw error;
        }
      }
    }

    // Return what we have after all iterations
    return {
      results: allResults,
      iterations: iteration,
      hitLimit: iteration >= this.maxIterations,
      metadata: {
        totalApiCalls,
        processingTime: Date.now() - startTime,
        errors: errorHistory.length > 0 ? errorHistory : undefined
      }
    };
  }

  /**
   * Record an error with metadata for feedback
   */
  protected recordError(error: unknown, iteration: number, phase: 'search' | 'evaluation' | 'refinement'): ErrorRecord {
    const message = error instanceof Error ? error.message : String(error);
    const recoverable = this.isRecoverableError(error);
    
    return {
      iteration,
      phase,
      message: message.slice(0, 500), // Truncate very long error messages
      recoverable,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Determine if an error is recoverable (should retry) or fatal (should throw)
   */
  protected isRecoverableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    
    // Fatal errors - don't retry
    if (message.includes('401') || message.includes('403')) return false; // Auth errors
    if (message.includes('Invalid API key')) return false;
    if (message.includes('quota exceeded')) return false;
    
    // Recoverable errors
    if (message.includes('JSON')) return true; // Parse errors
    if (message.includes('timeout')) return true;
    if (message.includes('500') || message.includes('502') || message.includes('503')) return true;
    if (message.includes('ECONNRESET') || message.includes('ETIMEDOUT')) return true;
    if (message.includes('No results')) return true;
    
    // Default to recoverable for unknown errors
    return true;
  }

  /**
   * Adjust search params after an error to try a different approach
   */
  protected adjustParamsAfterError(params: Record<string, any>, error: ErrorRecord): Record<string, any> {
    // Default implementation - subclasses can override for smarter adjustment
    const adjusted = { ...params };
    
    if (error.phase === 'search') {
      // Try expanding radius or relaxing filters
      if (adjusted.radius) {
        adjusted.radius = Math.min(adjusted.radius * 1.5, 50000);
      }
    }
    
    return adjusted;
  }

  /**
   * Format error history for inclusion in LLM prompts
   */
  protected formatErrorHistoryForPrompt(errors: ErrorRecord[]): string {
    if (!errors || errors.length === 0) return '';
    
    const errorSummary = errors.map(e => 
      `- Iteration ${e.iteration} (${e.phase}): ${e.message}`
    ).join('\n');
    
    return `
PREVIOUS ERRORS IN THIS SESSION:
${errorSummary}

Consider these errors when evaluating. If search errors occurred, be more lenient with scoring.
If evaluation errors occurred (like JSON parsing), ensure your response is valid JSON.`;
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
        max_output_tokens: 2500
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

