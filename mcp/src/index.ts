import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://usestrand.space'],
  credentials: true
}));
app.use(express.json());

// Tool registry
interface Tool {
  name: string;
  description: string;
  handler: (args: any) => Promise<any>;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

const tools = new Map<string, Tool>();

// Register test tool
tools.set('test', {
  name: 'test',
  description: 'A simple test tool to verify server is working',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'A test message'
      }
    },
    required: ['message']
  },
  handler: async (args: { message: string }) => {
    return {
      success: true,
      echo: args.message,
      timestamp: new Date().toISOString()
    };
  }
});

// Register search_places tool
tools.set('search_places', {
  name: 'search_places',
  description: 'Search for places using Google Maps API',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for places'
      },
      location: {
        type: 'string',
        description: 'Location to search near (e.g., "New York, NY")'
      },
      radius: {
        type: 'number',
        description: 'Search radius in meters',
        default: 5000
      }
    },
    required: ['query']
  },
  handler: async (args: { query: string; location?: string; radius?: number }) => {
    // TODO: Implement Google Maps API integration
    return {
      success: true,
      message: 'Places search not yet implemented',
      query: args.query,
      location: args.location || 'not specified',
      radius: args.radius || 5000
    };
  }
});

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
  const toolsList = Array.from(tools.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));

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
    
    const tool = tools.get(toolName);
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: `Tool '${toolName}' not found`
      });
    }

    const result = await tool.handler(args);
    
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
    const { message, conversationId } = req.body;

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    // Simulate AI response streaming (replace with actual AI integration)
    const response = `I'll help you plan that trip! Let me search for the best options in your area...`;
    const words = response.split(' ');

    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      res.write(`data: ${JSON.stringify({ type: 'token', content: word + ' ' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ 
      type: 'done',
      conversationId: conversationId || 'new-conversation-id'
    })}\n\n`);
    
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
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
