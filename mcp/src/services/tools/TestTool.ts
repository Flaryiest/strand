import { BaseTool } from './BaseTool.js';

export class TestTool extends BaseTool {
  name = 'test';
  description = 'A simple test tool to verify the system is working';
  parameters = {
    type: 'object' as const,
    properties: {
      message: {
        type: 'string',
        description: 'A test message to echo back'
      }
    },
    required: ['message']
  };

  async execute(params: { message: string }): Promise<any> {
    this.validateParams(params);

    return {
      success: true,
      echo: params.message,
      timestamp: new Date().toISOString(),
      toolName: this.name
    };
  }
}
