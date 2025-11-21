import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middle.js';

const chat: Router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all chat routes
chat.use(requireAuth);

const MCP_URL = process.env.MCP_URL || 'https://mcp.usestrand.space';

// Create new conversation
chat.post('/new', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log('Creating new conversation...');
    console.log('User from middleware:', (req as any).user);
    
    const userId = (req as any).user?.id;
    
    if (!userId) {
      console.error('No userId found in request');
      return res.status(401).json({
        success: false,
        error: 'User ID not found - authentication may have failed'
      });
    }

    console.log('User ID:', userId);

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: null,
        metadata: {}
      }
    });

    console.log('Conversation created:', conversation.id);

    res.status(201).json({
      success: true,
      conversation: {
        id: conversation.id,
        createdAt: conversation.createdAt
      }
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create conversation'
    });
  }
});// Get conversation history
chat.get(
  '/history/:conversationId',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user?.id;
      const { conversationId } = req.params;

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: parseInt(conversationId),
          userId
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            eventLog: msg.eventLog,
            metadata: msg.metadata,
            tokensUsed: msg.tokensUsed,
            toolCallsCount: msg.toolCallsCount,
            processingTime: msg.processingTime,
            createdAt: msg.createdAt
          }))
        }
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve conversation history'
      });
    }
  }
);

// List all conversations for user
chat.get('/list', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).send('Unauthorized');
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({
      success: true,
      conversations: conversations.map((conv) => ({
        id: conv.id,
        title:
          conv.title ||
          conv.messages[0]?.content?.substring(0, 50) ||
          'New Conversation',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
    });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list conversations'
    });
  }
});

// Stream AI response
chat.post('/stream', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const { conversationId, message } = req.body;

    if (!userId) {
      return res.status(401).send('Unauthorized');
    }

    if (!message || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Message and conversationId are required'
      });
    }

    // Verify conversation belongs to user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: parseInt(conversationId),
        userId
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        metadata: {}
      }
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Build conversation history for context
    const history = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));

    // Add current message
    history.push({ role: 'user', content: message });

    // Prepare request to MCP
    const mcpPayload = {
      userId,
      conversationId: conversation.id,
      messages: history
    };

    // Stream from MCP
    const startTime = Date.now();
    const eventLog: any[] = [];
    let fullResponse = '';
    let tokenCount = 0;
    let toolCallCount = 0;

    try {
      const response = await fetch(`${MCP_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mcpPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MCP Error: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`MCP service returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Failed to connect to MCP service: No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });

          // Forward to client
          res.write(chunk);

          // Parse and store for database
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.substring(6));
                eventLog.push(eventData);

                // Track metrics
                if (eventData.type === 'token') {
                  fullResponse += eventData.data.message || '';
                  tokenCount++;
                }
                if (eventData.type === 'action') {
                  toolCallCount++;
                }
              } catch (e) {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        }
      }

      const processingTime = Date.now() - startTime;

      // Save assistant message to database
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: fullResponse,
          eventLog,
          metadata: { mcpPayload },
          tokensUsed: tokenCount,
          toolCallsCount: toolCallCount,
          processingTime
        }
      });

      // Update conversation title if it's the first message
      if (!conversation.title && conversation.messages.length === 0) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            title: message.substring(0, 50)
          }
        });
      }

      res.end();
    } catch (error) {
      console.error('MCP request error:', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          data: { message: 'Failed to connect to AI service' }
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    console.error('Stream chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to process chat message'
      });
    }
  }
});

// Delete conversation
chat.delete(
  '/:conversationId',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user?.id;
      const { conversationId } = req.params;

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: parseInt(conversationId),
          userId
        }
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
      }

      await prisma.conversation.delete({
        where: { id: conversation.id }
      });

      res.json({
        success: true,
        message: 'Conversation deleted'
      });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation'
      });
    }
  }
);

export default chat;
