import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { toolRegistry } from './services/tools/ToolRegistry.js';
import { TestTool } from './services/tools/TestTool.js';
import { SearchPlacesTool } from './services/tools/SearchPlacesTool.js';
import { OpenAIService } from './services/ai/OpenAIService.js';
import { TransparencyLayer } from './services/ai/TransparencyLayer.js';

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

// Register tools
toolRegistry.register(new TestTool());
toolRegistry.register(new SearchPlacesTool());

console.log('🔧 Registered tools:', toolRegistry.getDefinitions().map(t => t.name));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'StrandAI Intelligence Server',
    version: '1.0.0',
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

// Execute a tool
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

// Streaming endpoint for AI agent queries
app.post('/stream/query', async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', message: 'Processing query...' })}\n\n`);

    // Simulate streaming response (replace with actual AI processing)
    const steps = [
      { type: 'thinking', message: 'Analyzing your trip requirements...' },
      { type: 'searching', message: 'Searching Google Maps for locations...' },
      { type: 'analyzing', message: 'Analyzing reviews and ratings...' },
      { type: 'optimizing', message: 'Optimizing route and timing...' },
      { type: 'complete', message: 'Trip plan ready!' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      res.write(`data: ${JSON.stringify(step)}\n\n`);
    }

    // Send final result
    const result = {
      type: 'result',
      data: {
        prompt,
        itinerary: [
          { place: 'Example Restaurant', time: '12:00 PM', duration: '1 hour' },
          { place: 'Example Museum', time: '2:00 PM', duration: '2 hours' }
        ]
      }
    };
    res.write(`data: ${JSON.stringify(result)}\n\n`);
    
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })}\n\n`);
    res.end();
  }
});

// Chat endpoint with streaming
app.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { messages, conversationId } = req.body;

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

    // Add system prompt
    const fullMessages = [
      OpenAIService.getSystemPrompt(),
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

app.listen(port, () => {
  console.log(`StrandAI Intelligence Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`List tools: http://localhost:${port}/tools`);
  console.log(`Chat stream: POST http://localhost:${port}/chat/stream`);
  console.log(`Query stream: POST http://localhost:${port}/stream/query`);
});
