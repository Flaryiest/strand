import { EventEmitter } from 'events';

export interface StreamEvent {
  type: 'thinking' | 'action' | 'data' | 'analyzing' | 'deciding' | 'token' | 'result' | 'error';
  step: number;
  timestamp: string;
  data: {
    message?: string;
    action?: string;
    params?: any;
    results?: any;
    analysis?: any;
    reasoning?: string;
    progress?: number;
  };
}

export class TransparencyLayer {
  private emitter: EventEmitter;
  private currentStep: number = 0;
  private streamCallback?: (event: StreamEvent) => void;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Set the callback function for streaming events
   */
  setStreamCallback(callback: (event: StreamEvent) => void): void {
    this.streamCallback = callback;
  }

  /**
   * Reset step counter for new conversation
   */
  reset(): void {
    this.currentStep = 0;
  }

  /**
   * Get the current step number
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Emit a step event
   */
  async emitStep(event: Omit<StreamEvent, 'step' | 'timestamp'>): Promise<void> {
    this.currentStep++;
    
    const fullEvent: StreamEvent = {
      ...event,
      step: this.currentStep,
      timestamp: new Date().toISOString()
    };

    // Emit through EventEmitter for internal listeners
    this.emitter.emit('step', fullEvent);

    // Call stream callback if set
    if (this.streamCallback) {
      this.streamCallback(fullEvent);
    }

    // Also log for debugging
    console.log(`[Step ${fullEvent.step}] ${fullEvent.type}: ${fullEvent.data.message || ''}`);
  }

  /**
   * Wrap a tool call with transparency events
   */
  async wrapToolCall<T>(
    toolName: string,
    params: any,
    executor: () => Promise<T>
  ): Promise<T> {
    // Emit: We're about to call this tool
    await this.emitStep({
      type: 'action',
      data: {
        message: `Calling ${toolName}...`,
        action: toolName,
        params
      }
    });

    // Execute the tool
    const startTime = Date.now();
    try {
      const result = await executor();
      const duration = Date.now() - startTime;

      // Emit: Here's what we got back
      await this.emitStep({
        type: 'data',
        data: {
          message: `Received data from ${toolName} (${duration}ms)`,
          results: result,
        }
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Emit error
      await this.emitStep({
        type: 'error',
        data: {
          message: `Error in ${toolName} after ${duration}ms`,
          results: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });

      throw error;
    }
  }

  /**
   * Emit thinking event
   */
  async thinking(message: string, progress?: number): Promise<void> {
    await this.emitStep({
      type: 'thinking',
      data: { message, progress }
    });
  }

  /**
   * Emit analyzing event
   */
  async analyzing(message: string, analysis?: any): Promise<void> {
    await this.emitStep({
      type: 'analyzing',
      data: { message, analysis }
    });
  }

  /**
   * Emit deciding event
   */
  async deciding(message: string, reasoning?: string): Promise<void> {
    await this.emitStep({
      type: 'deciding',
      data: { message, reasoning }
    });
  }

  /**
   * Emit token (streaming text)
   */
  async token(content: string): Promise<void> {
    await this.emitStep({
      type: 'token',
      data: { message: content }
    });
  }

  /**
   * Emit result event
   */
  async result(message: string, data?: any): Promise<void> {
    await this.emitStep({
      type: 'result',
      data: { message, results: data, progress: 100 }
    });
  }

  /**
   * Emit error event
   */
  async error(message: string, error?: any): Promise<void> {
    await this.emitStep({
      type: 'error',
      data: { message, results: { error } }
    });
  }

  /**
   * Subscribe to step events
   */
  on(event: 'step', listener: (event: StreamEvent) => void): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from step events
   */
  off(event: 'step', listener: (event: StreamEvent) => void): void {
    this.emitter.off(event, listener);
  }
}
