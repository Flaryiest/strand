import { create } from 'zustand';
import { ItineraryRecommendation } from '@/types/recommendation.types';

export interface StreamEvent {
  type:
    | 'thinking'
    | 'action'
    | 'data'
    | 'analyzing'
    | 'deciding'
    | 'token'
    | 'result'
    | 'error'
    | 'done';
  step: number;
  timestamp: string;
  data: {
    message?: string;
    action?: string;
    params?: any;
    results?: any;
    analysis?: any;
    reasoning?: string;
    progress?: number;
    fullResponse?: string;
    itinerary?: ItineraryRecommendation;
  };
}

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  events?: StreamEvent[];
  itinerary?: ItineraryRecommendation;
  metadata?: any;
  createdAt: string;
}

export interface ConversationSummary {
  id: number;
  uuid: string;
  title: string;
  initialLocation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupedConversations {
  today: ConversationSummary[];
  yesterday: ConversationSummary[];
  last7Days: ConversationSummary[];
  last30Days: ConversationSummary[];
  older: ConversationSummary[];
}

// Per-conversation streaming state
export interface ConversationStreamState {
  isStreaming: boolean;
  streamingEvents: StreamEvent[];
  accumulatedResponse: string;
  streamingItinerary: ItineraryRecommendation | null;
  activeRunId: string | null;
  activeAssistantMessageId: number | null;
  error: string | null;
}

// Per-conversation data (messages + metadata)
export interface ConversationData {
  id: number | null;
  messages: Message[];
}

interface ChatState {
  // Current conversation being viewed
  currentConversationUuid: string | null;
  
  // Per-conversation data stored in Maps
  conversationData: Map<string, ConversationData>;
  streamStates: Map<string, ConversationStreamState>;
  
  // Global state
  conversations: GroupedConversations;
  isLoadingConversations: boolean;

  // Helpers to get current conversation state
  getCurrentStreamState: () => ConversationStreamState | null;
  getCurrentMessages: () => Message[];
  getCurrentConversationId: () => number | null;
  
  // Check if any conversation is streaming
  hasActiveStreams: () => boolean;
  getActiveStreamCount: () => number;

  // Actions
  setCurrentConversation: (uuid: string | null, id?: number | null) => void;
  setConversations: (conversations: GroupedConversations) => void;
  setLoadingConversations: (loading: boolean) => void;
  
  // Per-conversation actions (require conversationUuid)
  setActiveRun: (
    conversationUuid: string,
    runId: string | null,
    assistantMessageId?: number | null
  ) => void;
  resumeRunStreaming: (
    conversationUuid: string,
    runId: string,
    assistantMessageId: number,
    initialResponse?: string
  ) => void;
  addUserMessage: (conversationUuid: string, content: string) => void;
  addStreamEvent: (conversationUuid: string, event: StreamEvent) => void;
  completeStreaming: (conversationUuid: string) => void;
  setError: (conversationUuid: string, error: string | null) => void;
  setMessages: (conversationUuid: string, messages: Message[], conversationId?: number) => void;
  
  // Cleanup
  clearStreamState: (conversationUuid: string) => void;
  reset: () => void;
  resetConversation: (conversationUuid: string) => void;
}

const emptyGroupedConversations: GroupedConversations = {
  today: [],
  yesterday: [],
  last7Days: [],
  last30Days: [],
  older: []
};

const createEmptyStreamState = (): ConversationStreamState => ({
  isStreaming: false,
  streamingEvents: [],
  accumulatedResponse: '',
  streamingItinerary: null,
  activeRunId: null,
  activeAssistantMessageId: null,
  error: null
});

const createEmptyConversationData = (): ConversationData => ({
  id: null,
  messages: []
});

export const useChatStore = create<ChatState>((set, get) => ({
  currentConversationUuid: null,
  conversationData: new Map(),
  streamStates: new Map(),
  conversations: emptyGroupedConversations,
  isLoadingConversations: false,

  // Helpers
  getCurrentStreamState: () => {
    const { currentConversationUuid, streamStates } = get();
    if (!currentConversationUuid) return null;
    return streamStates.get(currentConversationUuid) || null;
  },

  getCurrentMessages: () => {
    const { currentConversationUuid, conversationData } = get();
    if (!currentConversationUuid) return [];
    return conversationData.get(currentConversationUuid)?.messages || [];
  },

  getCurrentConversationId: () => {
    const { currentConversationUuid, conversationData } = get();
    if (!currentConversationUuid) return null;
    return conversationData.get(currentConversationUuid)?.id || null;
  },

  hasActiveStreams: () => {
    const { streamStates } = get();
    for (const state of streamStates.values()) {
      if (state.isStreaming) return true;
    }
    return false;
  },

  getActiveStreamCount: () => {
    const { streamStates } = get();
    let count = 0;
    for (const state of streamStates.values()) {
      if (state.isStreaming) count++;
    }
    return count;
  },

  // Actions
  setCurrentConversation: (uuid, id = null) => {
    set((state) => {
      // Initialize data structures if this is a new conversation
      const newConversationData = new Map(state.conversationData);
      const newStreamStates = new Map(state.streamStates);
      
      if (uuid && !newConversationData.has(uuid)) {
        newConversationData.set(uuid, { id, messages: [] });
      } else if (uuid && id !== null) {
        // Update conversation ID if provided
        const existing = newConversationData.get(uuid);
        if (existing) {
          newConversationData.set(uuid, { ...existing, id });
        }
      }
      
      if (uuid && !newStreamStates.has(uuid)) {
        newStreamStates.set(uuid, createEmptyStreamState());
      }
      
      return {
        currentConversationUuid: uuid,
        conversationData: newConversationData,
        streamStates: newStreamStates
      };
    });
  },

  setConversations: (conversations) => set({ conversations }),

  setLoadingConversations: (loading) => set({ isLoadingConversations: loading }),

  setActiveRun: (conversationUuid, runId, assistantMessageId = null) => {
    set((state) => {
      const newStreamStates = new Map(state.streamStates);
      const existing = newStreamStates.get(conversationUuid) || createEmptyStreamState();
      newStreamStates.set(conversationUuid, {
        ...existing,
        activeRunId: runId,
        activeAssistantMessageId: assistantMessageId
      });
      return { streamStates: newStreamStates };
    });
  },

  resumeRunStreaming: (conversationUuid, runId, assistantMessageId, initialResponse = '') => {
    set((state) => {
      const newStreamStates = new Map(state.streamStates);
      newStreamStates.set(conversationUuid, {
        isStreaming: true,
        streamingEvents: [],
        accumulatedResponse: initialResponse,
        streamingItinerary: null,
        error: null,
        activeRunId: runId,
        activeAssistantMessageId: assistantMessageId
      });
      return { streamStates: newStreamStates };
    });
  },

  setMessages: (conversationUuid, messages, conversationId) => {
    set((state) => {
      const newConversationData = new Map(state.conversationData);
      const existing = newConversationData.get(conversationUuid);
      newConversationData.set(conversationUuid, {
        id: conversationId ?? existing?.id ?? null,
        messages
      });
      
      // Also ensure stream state exists
      const newStreamStates = new Map(state.streamStates);
      if (!newStreamStates.has(conversationUuid)) {
        newStreamStates.set(conversationUuid, createEmptyStreamState());
      }
      
      return { 
        conversationData: newConversationData,
        streamStates: newStreamStates
      };
    });
  },

  addUserMessage: (conversationUuid, content) => {
    const newMessage: Message = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    
    set((state) => {
      // Update conversation data
      const newConversationData = new Map(state.conversationData);
      const existing = newConversationData.get(conversationUuid) || createEmptyConversationData();
      newConversationData.set(conversationUuid, {
        ...existing,
        messages: [...existing.messages, newMessage]
      });
      
      // Update stream state
      const newStreamStates = new Map(state.streamStates);
      const existingStream = newStreamStates.get(conversationUuid) || createEmptyStreamState();
      newStreamStates.set(conversationUuid, {
        ...existingStream,
        isStreaming: true,
        streamingEvents: [],
        accumulatedResponse: '',
        streamingItinerary: null,
        error: null
      });
      
      return {
        conversationData: newConversationData,
        streamStates: newStreamStates
      };
    });
  },

  addStreamEvent: (conversationUuid, event) => {
    set((state) => {
      const newStreamStates = new Map(state.streamStates);
      const existing = newStreamStates.get(conversationUuid);
      
      if (!existing) {
        console.warn(`[ChatStore] No stream state for conversation ${conversationUuid}`);
        return state;
      }
      
      const newEvents = [...existing.streamingEvents, event];
      let newAccumulated = existing.accumulatedResponse;
      let newItinerary = existing.streamingItinerary;

      // Accumulate token events into response text
      if (event.type === 'token' && event.data.message) {
        newAccumulated += event.data.message;
      }

      // Capture itinerary from done event
      if (event.type === 'done' && event.data.itinerary) {
        newItinerary = event.data.itinerary;
      }

      newStreamStates.set(conversationUuid, {
        ...existing,
        streamingEvents: newEvents,
        accumulatedResponse: newAccumulated,
        streamingItinerary: newItinerary
      });
      
      return { streamStates: newStreamStates };
    });
  },

  completeStreaming: (conversationUuid) => {
    set((state) => {
      const streamState = state.streamStates.get(conversationUuid);
      const convData = state.conversationData.get(conversationUuid);
      
      if (!streamState || !convData) {
        console.warn(`[ChatStore] Cannot complete streaming for ${conversationUuid} - missing state`);
        return state;
      }

      const assistantMessage: Message = {
        id: streamState.activeAssistantMessageId ?? Date.now(),
        role: 'assistant',
        content: streamState.accumulatedResponse,
        events: streamState.streamingEvents,
        itinerary: streamState.streamingItinerary || undefined,
        createdAt: new Date().toISOString()
      };

      // Update messages
      const existingIndex = convData.messages.findIndex(
        (m) => m.id === assistantMessage.id
      );
      const nextMessages = [...convData.messages];
      if (existingIndex >= 0) {
        nextMessages[existingIndex] = assistantMessage;
      } else {
        nextMessages.push(assistantMessage);
      }

      // Update conversation data
      const newConversationData = new Map(state.conversationData);
      newConversationData.set(conversationUuid, {
        ...convData,
        messages: nextMessages
      });

      // Reset stream state
      const newStreamStates = new Map(state.streamStates);
      newStreamStates.set(conversationUuid, createEmptyStreamState());

      return {
        conversationData: newConversationData,
        streamStates: newStreamStates
      };
    });
  },

  setError: (conversationUuid, error) => {
    set((state) => {
      const newStreamStates = new Map(state.streamStates);
      const existing = newStreamStates.get(conversationUuid) || createEmptyStreamState();
      newStreamStates.set(conversationUuid, {
        ...existing,
        error,
        isStreaming: false
      });
      return { streamStates: newStreamStates };
    });
  },

  clearStreamState: (conversationUuid) => {
    set((state) => {
      const newStreamStates = new Map(state.streamStates);
      newStreamStates.set(conversationUuid, createEmptyStreamState());
      return { streamStates: newStreamStates };
    });
  },

  resetConversation: (conversationUuid) => {
    set((state) => {
      const newConversationData = new Map(state.conversationData);
      const newStreamStates = new Map(state.streamStates);
      newConversationData.delete(conversationUuid);
      newStreamStates.delete(conversationUuid);
      return {
        conversationData: newConversationData,
        streamStates: newStreamStates,
        currentConversationUuid: state.currentConversationUuid === conversationUuid 
          ? null 
          : state.currentConversationUuid
      };
    });
  },

  reset: () => {
    set({
      currentConversationUuid: null,
      conversationData: new Map(),
      streamStates: new Map(),
      // Keep conversations list intact
    });
  }
}));

// Helper hook to get streaming state for current conversation
export const useCurrentStreamState = (): ConversationStreamState => {
  const currentUuid = useChatStore((s) => s.currentConversationUuid);
  const streamStates = useChatStore((s) => s.streamStates);
  if (!currentUuid) return createEmptyStreamState();
  return streamStates.get(currentUuid) || createEmptyStreamState();
};

// Helper hook to get messages for current conversation
export const useCurrentMessages = (): Message[] => {
  const currentUuid = useChatStore((s) => s.currentConversationUuid);
  const conversationData = useChatStore((s) => s.conversationData);
  if (!currentUuid) return [];
  return conversationData.get(currentUuid)?.messages || [];
};

