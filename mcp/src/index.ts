import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { toolRegistry } from './services/tools/ToolRegistry.js';
import { TestTool } from './services/tools/TestTool.js';
import { SearchPlacesTool } from './services/tools/SearchPlacesTool.js';
import { WebSearchTool } from './services/tools/WebSearchTool.js';
import { RedditSearchTool } from './services/tools/RedditSearchTool.js';
import { OpenAIService } from './services/ai/OpenAIService.js';
import { TransparencyLayer } from './services/ai/TransparencyLayer.js';
import { Orchestrator } from './services/agents/Orchestrator.js';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://usestrand.space',
    'https://backend.usestrand.space'
  ],
  credentials: true
}));
app.use(express.json());

// Register tools (for direct tool access)
toolRegistry.register(new TestTool());
toolRegistry.register(new SearchPlacesTool());
toolRegistry.register(new WebSearchTool());
toolRegistry.register(new RedditSearchTool());

console.log('[Tools] Registered:', toolRegistry.getDefinitions().map(t => t.name));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'StrandAI Intelligence Server',
    version: '2.0.0',
    features: ['orchestrator', 'multi-agent', 'iterative-refinement'],
    timestamp: new Date().toISOString()
  });
});

// List available tools
app.get('/tools', (req: Request, res: Response) => {
  const toolsList = toolRegistry.getDefinitions();

  res.json({
    success: true,
    tools: toolsList
  });
});

// Execute a tool directly
app.post('/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const args = req.body;
    
    if (!toolRegistry.has(toolName)) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`
      });
    }

    const result = await toolRegistry.execute(toolName, args);
    
    res.json({
      success: true,
      tool: toolName,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Main chat endpoint with Orchestrator (new hybrid agent architecture)
 * This endpoint uses the Plan-Execute pattern with multiple specialized agents
 */
app.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { messages, conversationId, location, useOrchestrator = true } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create transparency layer for this conversation
    const transparency = new TransparencyLayer();

    // Listen to all transparency events and forward them as SSE
    transparency.on('step', (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Extract the latest user message as the query
    const latestUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop();
    
    const query = latestUserMessage?.content || '';

    if (useOrchestrator && query) {
      // Use new Orchestrator-based flow
      console.log('[MCP] Using Orchestrator for query:', query);
      
      const orchestrator = new Orchestrator();
      
      try {
        const result = await orchestrator.process({
          query,
          location: location || undefined,
          transparency
        });

        // Stream the final response as tokens
        const responseChunks = result.response.split(' ');
        for (const chunk of responseChunks) {
          transparency.token(chunk + ' ');
          await new Promise(resolve => setTimeout(resolve, 20)); // Small delay for streaming effect
        }

        // Send final completion event with itinerary data
        res.write(`data: ${JSON.stringify({ 
          type: 'done',
          step: transparency.getCurrentStep(),
          timestamp: new Date().toISOString(),
          data: {
            fullResponse: result.response,
            itinerary: result.itinerary || null,
            conversationId,
            metadata: result.metadata
          }
        })}\n\n`);
        
        res.end();
      } catch (error) {
        console.error('[MCP] Orchestrator error:', error);
        // Fall back to legacy flow
        await handleLegacyChat(messages, location, transparency, res, conversationId);
      }
    } else {
      // Use legacy single-agent flow
      await handleLegacyChat(messages, location, transparency, res, conversationId);
    }
  } catch (error) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error',
      step: 0,
      timestamp: new Date().toISOString(),
      data: {
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    })}\n\n`);
    res.end();
  }
});

/**
 * Legacy chat handler using direct OpenAI with tool calling
 */
async function handleLegacyChat(
  messages: any[],
  location: string | undefined,
  transparency: TransparencyLayer,
  res: Response,
  conversationId?: number
) {
  // Add system prompt with location context
  const fullMessages = [
    OpenAIService.getSystemPrompt(location),
    ...messages
  ];

  // Initialize OpenAI service
  const openai = new OpenAIService();

  // Stream the response
  const response = await openai.streamChatCompletion({
    messages: fullMessages,
    conversationId: conversationId || 0,
    transparency,
    onToken: (token) => {
      // Tokens are already emitted via transparency layer
    }
  });

  // Send final completion event
  res.write(`data: ${JSON.stringify({ 
    type: 'done',
    step: transparency.getCurrentStep(),
    timestamp: new Date().toISOString(),
    data: {
      fullResponse: response,
      conversationId
    }
  })}\n\n`);
  
  res.end();
}

/**
 * Direct orchestrator endpoint for testing
 */
app.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const { query, location, budget, preferences } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const orchestrator = new Orchestrator();
    const result = await orchestrator.process({
      query,
      location,
      budget,
      preferences
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Orchestrate error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`\n[Server] StrandAI Intelligence Server v2.0`);
  console.log(`         Running on port ${port}\n`);
  console.log(`[Endpoints]`);
  console.log(`   GET  /health        - Health check`);
  console.log(`   GET  /tools         - List available tools`);
  console.log(`   POST /tools/:name   - Execute a tool directly`);
  console.log(`   POST /chat/stream   - Chat with Orchestrator (SSE)`);
  console.log(`   POST /orchestrate   - Direct orchestrator call (JSON)\n`);
  console.log(`[Agents] PlacesAgent, WebSearchAgent, RedditAgent`);
  console.log(`[Tools] ${toolRegistry.getNames().join(', ')}\n`);
});
