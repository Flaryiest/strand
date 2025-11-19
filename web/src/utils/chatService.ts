import { baseUrl } from './baseUrl';

export interface Conversation {
  id: number;
  createdAt: string;
  title?: string;
  updatedAt?: string;
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  eventLog?: any;
  metadata?: any;
  tokensUsed?: number;
  toolCallsCount?: number;
  processingTime?: number;
  createdAt: string;
}

export interface ConversationHistory {
  id: number;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

/**
 * Create a new conversation
 */
export async function createConversation(): Promise<Conversation> {
  const response = await fetch(`${baseUrl}/chat/new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include' // This is crucial for sending cookies
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Failed to create conversation: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.conversation;
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: number
): Promise<ConversationHistory> {
  const response = await fetch(`${baseUrl}/chat/history/${conversationId}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to get conversation history: ${response.statusText}`);
  }

  const data = await response.json();
  return data.conversation;
}

/**
 * List all conversations for the user
 */
export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch(`${baseUrl}/chat/list`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to list conversations: ${response.statusText}`);
  }

  const data = await response.json();
  return data.conversations;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: number): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/${conversationId}`, {
    method: 'DELETE',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
}

/**
 * Stream a chat message (returns EventSource or similar)
 */
export async function streamChatMessage(
  conversationId: number,
  message: string
): Promise<Response> {
  const response = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      conversationId,
      message
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  return response;
}
