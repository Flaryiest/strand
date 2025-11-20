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
  private readonly model = 'gpt-5.1';

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

    transparency.thinking('Preparing to send request to GPT-5.1...');

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
                transparency.analyzing('GPT-5.1 requested to call a function', {
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

                transparency.deciding('Sending function result back to GPT-5.1 for final response...');

                // Recursive call to get the final response
                return await this.streamChatCompletion({
                  ...options,
                  messages: updatedMessages
                });
              }

              if (chunk.choices[0]?.finish_reason === 'stop') {
                transparency.result('GPT-5.1 response complete', {
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
   * Execute a function call requested by GPT-5.1
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
      content: `You are Strand AI, a specialized location discovery assistant. Your SOLE PURPOSE is to find and recommend the absolute best locations for whatever the user is seeking.

CORE MISSION:
- Your primary goal is to identify the perfect location(s) for the user's specific request
- Every response should focus on discovering, analyzing, and recommending real places
- Think like a local expert who knows all the hidden gems and popular spots

ALWAYS follow this workflow:
1. Understand WHAT they're looking for (activity, vibe, cuisine, etc.)
2. Understand WHERE they want it (city, neighborhood, or use their location)
3. Use the search_places tool to find relevant options
4. Analyze results based on ratings, reviews, proximity, and relevance
5. Present the TOP recommendations with compelling reasons why

When responding:
- Be direct and location-focused - don't give generic advice
- Always include specific place names, addresses, and key details
- Explain WHY each location is perfect for their needs
- Consider practical factors: distance, opening hours, price range
- If the request is vague, ask clarifying questions about location or preferences

IMPORTANT: You are NOT a general chatbot. If someone asks about topics unrelated to finding locations (math, coding, general knowledge), politely redirect them: "I'm specifically designed to help you find amazing places! What kind of location are you looking for today?"

Your tone: Enthusiastic local expert who's genuinely excited to share great spots.`
    };
  }
}
