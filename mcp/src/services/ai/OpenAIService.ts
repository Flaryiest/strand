import { config } from '../../config.js';
import { TransparencyLayer } from '../ai/TransparencyLayer.js';
import { toolRegistry } from '../tools/ToolRegistry.js';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

interface OpenAIStreamOptions {
  messages: Message[];
  conversationId: number;
  transparency: TransparencyLayer;
  onToken?: (token: string) => void;
}

interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
    };
    finish_reason: string | null;
  }>;
}

export class OpenAIService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly model = 'gpt-4-turbo-preview';

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    this.apiKey = config.openaiApiKey;
  }

  /**
   * Stream a chat completion with function calling support
   */
  async streamChatCompletion(options: OpenAIStreamOptions): Promise<string> {
    const { messages, transparency, onToken } = options;

    transparency.thinking('Preparing to send request to GPT-4...');

    // Build the request payload
    const payload = {
      model: this.model,
      messages,
      functions: toolRegistry.getDefinitions(),
      function_call: 'auto',
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    };

    transparency.analyzing('Sending request to OpenAI API...', {
      model: this.model,
      messageCount: messages.length,
      availableFunctions: toolRegistry.getDefinitions().map(f => f.name)
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let functionCall: { name: string; arguments: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.trim() === 'data: [DONE]') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const chunk: ChatCompletionChunk = JSON.parse(jsonStr);
              const delta = chunk.choices[0]?.delta;

              if (!delta) continue;

              // Handle regular content tokens
              if (delta.content) {
                fullContent += delta.content;
                transparency.token(delta.content);
                if (onToken) {
                  onToken(delta.content);
                }
              }

              // Handle function call
              if (delta.function_call) {
                if (!functionCall) {
                  functionCall = { name: '', arguments: '' };
                }
                if (delta.function_call.name) {
                  functionCall.name = delta.function_call.name;
                }
                if (delta.function_call.arguments) {
                  functionCall.arguments += delta.function_call.arguments;
                }
              }

              // Check if we're done
              if (chunk.choices[0]?.finish_reason === 'function_call' && functionCall) {
                transparency.analyzing('GPT-4 requested to call a function', {
                  function: functionCall.name,
                  arguments: functionCall.arguments
                });

                // Execute the function
                const result = await this.executeFunctionCall(
                  functionCall.name,
                  functionCall.arguments,
                  transparency
                );

                // Add function result to messages and continue the conversation
                const updatedMessages = [
                  ...messages,
                  {
                    role: 'assistant' as const,
                    content: '',
                    function_call: functionCall
                  },
                  {
                    role: 'function' as const,
                    name: functionCall.name,
                    content: JSON.stringify(result)
                  }
                ];

                transparency.deciding('Sending function result back to GPT-4 for final response...');

                // Recursive call to get the final response
                return await this.streamChatCompletion({
                  ...options,
                  messages: updatedMessages
                });
              }

              if (chunk.choices[0]?.finish_reason === 'stop') {
                transparency.result('GPT-4 response complete', {
                  totalLength: fullContent.length
                });
                return fullContent;
              }

            } catch (parseError) {
              console.error('Error parsing SSE chunk:', parseError);
              continue;
            }
          }
        }
      }

      return fullContent;

    } catch (error) {
      transparency.error('Error communicating with OpenAI', error);
      throw error;
    }
  }

  /**
   * Execute a function call requested by GPT-4
   */
  private async executeFunctionCall(
    functionName: string,
    argumentsJson: string,
    transparency: TransparencyLayer
  ): Promise<any> {
    try {
      const args = JSON.parse(argumentsJson);
      
      transparency.analyzing(`Executing tool: ${functionName}`, { arguments: args });

      const result = await transparency.wrapToolCall(
        functionName,
        args,
        async () => {
          return await toolRegistry.execute(functionName, args);
        }
      );

      transparency.analyzing('Tool execution completed', {
        tool: functionName,
        resultPreview: JSON.stringify(result).slice(0, 200)
      });

      return result;

    } catch (error) {
      transparency.error(`Error executing function ${functionName}`, error);
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build system prompt for the AI assistant
   */
  static getSystemPrompt(): Message {
    return {
      role: 'system',
      content: `You are Strand AI, an intelligent travel planning assistant. Your role is to help users plan amazing trips by:

1. Understanding their travel preferences, budget, and constraints
2. Searching for relevant places, restaurants, hotels, and attractions
3. Providing thoughtful recommendations based on their needs
4. Creating detailed itineraries that make sense logistically

When using tools:
- Always search for places when users ask about destinations, restaurants, hotels, or activities
- Be specific in your searches (include location context)
- Provide rich, detailed responses with practical information
- Consider factors like distance, ratings, and user preferences

Be conversational, helpful, and enthusiastic about travel. Make users excited about their upcoming trips!`
    };
  }
}
