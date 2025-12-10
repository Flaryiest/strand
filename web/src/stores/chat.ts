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

interface ChatState {
  conversationId: number | null;
  conversationUuid: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingEvents: StreamEvent[];
  accumulatedResponse: string;
  streamingItinerary: ItineraryRecommendation | null;
  error: string | null;
  conversations: GroupedConversations;
  isLoadingConversations: boolean;

  setConversationId: (id: number) => void;
  setConversationUuid: (uuid: string) => void;
  setConversations: (conversations: GroupedConversations) => void;
  setLoadingConversations: (loading: boolean) => void;
  addUserMessage: (content: string) => void;
  addStreamEvent: (event: StreamEvent) => void;
  completeStreaming: () => void;
  setError: (error: string | null) => void;
  setMessages: (messages: Message[]) => void;
  reset: () => void;
}

const emptyGroupedConversations: GroupedConversations = {
  today: [],
  yesterday: [],
  last7Days: [],
  last30Days: [],
  older: []
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  conversationUuid: null,
  messages: [],
  isStreaming: false,
  streamingEvents: [],
  accumulatedResponse: '',
  streamingItinerary: null,
  error: null,
  conversations: emptyGroupedConversations,
  isLoadingConversations: false,

  setConversationId: (id) => set({ conversationId: id }),

  setConversationUuid: (uuid) => set({ conversationUuid: uuid }),

  setConversations: (conversations) => set({ conversations }),

  setLoadingConversations: (loading) =>
    set({ isLoadingConversations: loading }),

  setMessages: (messages) => set({ messages }),

  addUserMessage: (content) => {
    const newMessage: Message = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
      isStreaming: true,
      streamingEvents: [],
      accumulatedResponse: '',
      streamingItinerary: null,
      error: null
    }));
  },

  addStreamEvent: (event) => {
    set((state) => {
      const newEvents = [...state.streamingEvents, event];
      let newAccumulated = state.accumulatedResponse;
      let newItinerary = state.streamingItinerary;

      // Accumulate token events into response text
      if (event.type === 'token' && event.data.message) {
        newAccumulated += event.data.message;
      }

      // Capture itinerary from done event
      if (event.type === 'done' && event.data.itinerary) {
        newItinerary = event.data.itinerary;
      }

      return {
        streamingEvents: newEvents,
        accumulatedResponse: newAccumulated,
        streamingItinerary: newItinerary
      };
    });
  },

  completeStreaming: () => {
    const { streamingEvents, accumulatedResponse, streamingItinerary } = get();

    const assistantMessage: Message = {
      id: Date.now(),
      role: 'assistant',
      content: accumulatedResponse,
      events: streamingEvents,
      itinerary: streamingItinerary || undefined,
      createdAt: new Date().toISOString()
    };

    set((state) => ({
      messages: [...state.messages, assistantMessage],
      isStreaming: false,
      streamingEvents: [],
      accumulatedResponse: '',
      streamingItinerary: null
    }));
  },

  setError: (error) => set({ error, isStreaming: false }),

  reset: () =>
    set({
      conversationId: null,
      conversationUuid: null,
      messages: [],
      isStreaming: false,
      streamingEvents: [],
      accumulatedResponse: '',
      streamingItinerary: null,
      error: null
    })
}));
