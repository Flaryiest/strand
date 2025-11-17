export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolDefinition['parameters'];

  /**
   * Execute the tool with given parameters
   */
  abstract execute(params: any): Promise<any>;

  /**
   * Get the OpenAI function definition for this tool
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters
    };
  }

  /**
   * Validate parameters before execution
   */
  protected validateParams(params: any): void {
    const required = this.parameters.required || [];
    for (const param of required) {
      if (!(param in params) || params[param] === undefined || params[param] === null) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }
}
