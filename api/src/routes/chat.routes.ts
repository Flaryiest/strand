import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middle.js';

const chat: Router = express.Router();
const prisma = new PrismaClient();

const MCP_URL = process.env.MCP_URL || 'https://mcp.usestrand.space';

// Public endpoint - Get conversation by UUID (no auth required)
chat.get('/public/:uuid', async (req: Request, res: Response): Promise<any> => {
  try {
    const { uuid } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { uuid },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        user: {
          select: {
            firstName: true,
            profilePicture: true
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
        uuid: conversation.uuid,
        title: conversation.title,
        initialLocation: conversation.initialLocation,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        user: {
          firstName: conversation.user.firstName,
          profilePicture: conversation.user.profilePicture
        },
        messages: conversation.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          eventLog: msg.eventLog,
          createdAt: msg.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get public conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation'
    });
  }
});

// Apply authentication middleware to remaining routes
chat.use(requireAuth);

// Create new conversation
chat.post('/new', async (req: Request, res: Response): Promise<any> => {
  try {
    console.log('Creating new conversation...');
    console.log('User from middleware:', (req as any).user);
    
    const userId = (req as any).user?.id;
    const { initialLocation } = req.body;
    
    if (!userId) {
      console.error('No userId found in request');
      return res.status(401).json({
        success: false,
        error: 'User ID not found - authentication may have failed'
      });
    }

    console.log('User ID:', userId);

    // Credit cost is 0 for now
    const creditCost = 0;

    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: null,
        initialLocation: initialLocation || null,
        creditCost,
        metadata: {}
      }
    });

    // Deduct credits from user (currently 0, so no change)
    if (creditCost > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            decrement: creditCost
          }
        }
      });
    }

    console.log('Conversation created:', conversation.id, 'UUID:', conversation.uuid);

    res.status(201).json({
      success: true,
      conversation: {
        id: conversation.id,
        uuid: conversation.uuid,
        initialLocation: conversation.initialLocation,
        creditCost: conversation.creditCost,
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
});// Get conversation history by UUID (authenticated - for owner)
chat.get(
  '/history/:uuid',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user?.id;
      const { uuid } = req.params;

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          uuid,
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
          uuid: (conversation as any).uuid,
          title: conversation.title,
          initialLocation: (conversation as any).initialLocation,
          creditCost: (conversation as any).creditCost,
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

// List all conversations for user (grouped by date)
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

    // Group conversations by time period
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const grouped = {
      today: [] as any[],
      yesterday: [] as any[],
      last7Days: [] as any[],
      last30Days: [] as any[],
      older: [] as any[]
    };

    for (const conv of conversations) {
      const convData = {
        id: conv.id,
        uuid: (conv as any).uuid,
        title:
          conv.title ||
          conv.messages[0]?.content?.substring(0, 50) ||
          'New Conversation',
        initialLocation: (conv as any).initialLocation,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };

      const convDate = new Date(conv.updatedAt);
      
      if (convDate >= today) {
        grouped.today.push(convData);
      } else if (convDate >= yesterday) {
        grouped.yesterday.push(convData);
      } else if (convDate >= last7Days) {
        grouped.last7Days.push(convData);
      } else if (convDate >= last30Days) {
        grouped.last30Days.push(convData);
      } else {
        grouped.older.push(convData);
      }
    }

    res.json({
      success: true,
      conversations: grouped
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
    const { conversationUuid, message } = req.body;

    if (!userId) {
      return res.status(401).send('Unauthorized');
    }

    if (!message || !conversationUuid) {
      return res.status(400).json({
        success: false,
        error: 'Message and conversationUuid are required'
      });
    }

    // Verify conversation belongs to user (using UUID)
    const conversation = await prisma.conversation.findFirst({
      where: {
        uuid: conversationUuid,
        userId
      } as any,
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
    const history = (conversation as any).messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    // Add current message
    history.push({ role: 'user', content: message });

    // Get location from request body
    const { location } = req.body;

    // Prepare request to MCP
    const mcpPayload = {
      userId,
      conversationId: conversation.id,
      messages: history,
      location: location || null
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

// Delete conversation by UUID
chat.delete(
  '/:uuid',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user?.id;
      const { uuid } = req.params;

      if (!userId) {
        return res.status(401).send('Unauthorized');
      }

      const conversation = await prisma.conversation.findFirst({
        where: {
          uuid,
          userId
        } as any
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
