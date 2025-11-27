import { config } from '../../config.js';
import { TransparencyLayer } from '../ai/TransparencyLayer.js';
import { toolRegistry } from '../tools/ToolRegistry.js';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
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
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
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

    // Convert tool definitions to the new tools format
    const tools = toolRegistry.getDefinitions().map(def => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters
      }
    }));

    // Build the request payload
    const payload = {
      model: this.model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: true,
      temperature: 0.7,
      max_completion_tokens: 2000
    };

    transparency.analyzing('Sending request to OpenAI API...', {
      model: this.model,
      messageCount: messages.length,
      availableTools: tools.map(t => t.function.name)
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
      let toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

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

              // Handle tool calls (new format)
              if (delta.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;
                  
                  if (!toolCalls.has(index)) {
                    toolCalls.set(index, { id: '', name: '', arguments: '' });
                  }
                  
                  const toolCall = toolCalls.get(index)!;
                  
                  if (toolCallDelta.id) {
                    toolCall.id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function?.name) {
                    toolCall.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCall.arguments += toolCallDelta.function.arguments;
                  }
                }
              }

              // Check if we're done with tool calls
              if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCalls.size > 0) {
                const toolCallsArray = Array.from(toolCalls.values());
                
                transparency.analyzing('GPT-5.1 requested to call tools', {
                  tools: toolCallsArray.map(tc => tc.name)
                });

                // Execute all tool calls
                const toolResults: Array<{ tool_call_id: string; result: any }> = [];
                
                for (const toolCall of toolCallsArray) {
                  const result = await this.executeFunctionCall(
                    toolCall.name,
                    toolCall.arguments,
                    transparency
                  );
                  toolResults.push({ tool_call_id: toolCall.id, result });
                }

                // Build updated messages with tool results
                const assistantMessage: Message = {
                  role: 'assistant',
                  content: null,
                  tool_calls: toolCallsArray.map(tc => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: {
                      name: tc.name,
                      arguments: tc.arguments
                    }
                  }))
                };

                const toolResultMessages: Message[] = toolResults.map(tr => ({
                  role: 'tool' as const,
                  content: JSON.stringify(tr.result),
                  tool_call_id: tr.tool_call_id
                }));

                const updatedMessages: Message[] = [
                  ...messages,
                  assistantMessage,
                  ...toolResultMessages
                ];

                transparency.deciding('Sending tool results back to GPT-5.1 for final response...');

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
  static getSystemPrompt(userLocation?: string | null): Message {
    const locationContext = userLocation && userLocation !== 'Unknown' 
      ? `The user's current location is: ${userLocation}. Use this as the default search area.`
      : 'The user has not shared their location. If needed, ask for a city/area to search in.';

    return {
      role: 'system',
      content: `You are Strand AI, an ACTION-ORIENTED location discovery assistant. Your job is to IMMEDIATELY search and find the best places—don't ask unnecessary questions.

USER LOCATION CONTEXT:
${locationContext}

CORE BEHAVIOR - BE PROACTIVE:
1. When a user mentions ANY place type (food, drinks, activities, etc.), IMMEDIATELY call search_places
2. DO NOT ask clarifying questions if you already have location context
3. Only ask questions if the location is truly unknown AND critical to the search

SEARCH STRATEGY:
- Always use the user's location as the search area when available
- For queries like "matcha" → search for "best matcha cafe" or "matcha latte"
- For queries like "date night" → search for "romantic restaurants" 
- Be smart about interpreting intent and expanding queries appropriately

RESPONSE FORMAT - STRUCTURED CARDS:
After searching, format your response as recommendation cards. Use this EXACT markdown structure:

---
## 🏆 Top Pick: [Place Name]
**Address:** [Full address]
**Rating:** ⭐ [X.X]/5 ([price level if available])
**Distance:** [Approximate distance from user if location known]

**Why this spot?**
[2-3 sentences explaining why this is the TOP recommendation. Reference specific factors: highest rating, best reviews for the category, proximity, unique offerings, etc.]

---

### Other Great Options:

**2. [Place Name]** - ⭐ [Rating]
[Address]
_Why: [1 sentence on what makes it good and how it compares to #1]_

**3. [Place Name]** - ⭐ [Rating]
[Address]
_Why: [1 sentence on what makes it good]_

---

RANKING CRITERIA (explain your reasoning):
1. **Quality** - Ratings above 4.5 are prioritized
2. **Relevance** - How well it matches the user's request
3. **Distance** - Closer is better when quality is similar
4. **Price** - Consider value; mention if it's a splurge or budget-friendly

IMPORTANT RULES:
- ALWAYS call search_places first before responding with recommendations
- Include the reasoning for why you picked #1 over the alternatives
- If no results found, suggest broadening the search or trying nearby areas
- Keep responses concise but informative
- Never make up places - only recommend real results from the search

TONE: Confident local expert. "I found the perfect spot" not "You might want to try..."

NON-LOCATION QUERIES:
If someone asks about topics unrelated to finding places, respond: "I'm your location discovery assistant! I'm great at finding amazing spots. What kind of place are you looking for?"`
    };
  }
}
