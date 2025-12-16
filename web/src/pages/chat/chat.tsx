import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { baseUrl } from '@/utils/baseUrl';
import { useLocationStore } from '@/stores/location';
import { useChatStore, useCurrentStreamState, useCurrentMessages } from '@/stores/chat';
import Sidebar from '@/components/sidebar/sidebar';
import Topbar from '@/components/topbar/topbar';
import LocationInput from '@/components/locationInput/locationInput';
import { NarrativeStream } from '@/components/narrativeStream';
import ItineraryView from '@/components/itineraryView/itineraryView';
import styles from './chat.module.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const { isAuthenticated, isLoading, isInitializing, user } = useAuth();
  const { location, detectLocation } = useLocationStore();
  
  // Global store actions and state
  const {
    currentConversationUuid,
    conversations,
    isLoadingConversations,
    setCurrentConversation,
    setConversations,
    setLoadingConversations,
    setActiveRun,
    resumeRunStreaming,
    setMessages,
    addUserMessage,
    addStreamEvent,
    completeStreaming,
    setError
  } = useChatStore();
  
  // Per-conversation state (reactive hooks)
  const currentStreamState = useCurrentStreamState();
  const messages = useCurrentMessages();
  
  // Derived state from currentStreamState
  const isStreaming = currentStreamState.isStreaming;
  const streamingEvents = currentStreamState.streamingEvents;
  const streamingItinerary = currentStreamState.streamingItinerary;
  const error = currentStreamState.error;
  const activeAssistantMessageId = currentStreamState.activeAssistantMessageId;

  const [activeView, setActiveView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [animationState, setAnimationState] = useState<
    'pre' | 'animating' | 'done'
  >('pre');
  const [inputValue, setInputValue] = useState('');
  const [showInitialUI, setShowInitialUI] = useState(true);
  const [isPublicView, setIsPublicView] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // Map of conversationUuid -> EventSource for multi-query support
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  const runLastIdStorageKey = (runId: string) =>
    `strand:chatRun:${runId}:lastId`;

  const stopEventSource = (conversationUuid: string) => {
    const es = eventSourcesRef.current.get(conversationUuid);
    if (es) {
      es.close();
      eventSourcesRef.current.delete(conversationUuid);
    }
  };

  const stopAllEventSources = () => {
    for (const [uuid, es] of eventSourcesRef.current.entries()) {
      es.close();
      eventSourcesRef.current.delete(uuid);
    }
  };

  const isEventSourceActive = (conversationUuid: string) => {
    const es = eventSourcesRef.current.get(conversationUuid);
    if (!es) return false;
    return es.readyState !== EventSource.CLOSED;
  };

  const startEventSource = (
    convUuid: string,
    runId: string,
    replayFromStart: boolean = false
  ) => {
    // Close any existing EventSource for this conversation
    stopEventSource(convUuid);

    // If replaying from start (e.g., page refresh recovery), ignore sessionStorage
    const afterId = replayFromStart
      ? '0-0'
      : sessionStorage.getItem(runLastIdStorageKey(runId)) || '0-0';
    const url = `${baseUrl}/chat/runs/${runId}/stream?afterId=${encodeURIComponent(afterId)}`;

    const es = new EventSource(url, { withCredentials: true });
    eventSourcesRef.current.set(convUuid, es);

    es.onmessage = (evt) => {
      // Verify this EventSource is still registered for this conversation
      if (eventSourcesRef.current.get(convUuid) !== es) {
        console.log(`[EventSource] Ignoring event for replaced EventSource on ${convUuid}`);
        return;
      }

      try {
        const eventData = JSON.parse(evt.data);
        if (evt.lastEventId) {
          sessionStorage.setItem(runLastIdStorageKey(runId), evt.lastEventId);
        }

        if (eventData.type === 'done') {
          // Process the done event first to capture the itinerary
          addStreamEvent(convUuid, eventData);
          sessionStorage.removeItem(runLastIdStorageKey(runId));
          completeStreaming(convUuid);
          refreshConversations();
          stopEventSource(convUuid);
        } else if (eventData.type === 'error') {
          setError(convUuid, eventData.data?.message || 'Stream error');
          stopEventSource(convUuid);
        } else {
          addStreamEvent(convUuid, eventData);
        }
      } catch (e) {
        console.error('EventSource parse error:', e);
      }
    };

    es.onerror = () => {
      // Allow EventSource to auto-reconnect; do not force-close here.
    };
  };

  const refreshConversations = async () => {
    if (!isAuthenticated) return;

    setLoadingConversations(true);
    try {
      const response = await fetch(`${baseUrl}/chat/list`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConversations(data.conversations);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load conversation from URL if chatId is present
  useEffect(() => {
    const loadConversation = async () => {
      if (!chatId) {
        // No chatId in URL, show fresh chat
        // Set current conversation to null but don't reset everything
        setCurrentConversation(null);
        setShowInitialUI(true);
        return;
      }

      // Set current conversation UUID for this view
      setCurrentConversation(chatId);

      // Check if we already have this conversation loaded with messages
      const store = useChatStore.getState();
      const existingData = store.conversationData.get(chatId);
      const existingStream = store.streamStates.get(chatId);
      
      if (existingData && existingData.messages.length > 0) {
        setShowInitialUI(false);

        // If there's an active run for this conversation, make sure we are attached.
        const lastAssistant = [...existingData.messages]
          .reverse()
          .find((m) => m.role === 'assistant');
        const runId = lastAssistant?.metadata?.runId;
        const isStreamingMsg =
          lastAssistant?.metadata?.status === 'streaming' &&
          typeof runId === 'string';

        if (isStreamingMsg) {
          // Only (re)attach if we aren't already attached.
          if (!isEventSourceActive(chatId)) {
            resumeRunStreaming(
              chatId,
              runId,
              lastAssistant.id,
              lastAssistant.content || ''
            );
            startEventSource(chatId, runId, true); // Replay all events from start
          }
        } else if (!existingStream?.isStreaming) {
          stopEventSource(chatId);
          setActiveRun(chatId, null);
        }

        return;
      }

      setIsTransitioning(true);

      try {
        // Try to load as authenticated user first
        if (isAuthenticated) {
          const response = await fetch(`${baseUrl}/chat/history/${chatId}`, {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.conversation) {
              setCurrentConversation(chatId, data.conversation.id);
              setMessages(
                chatId,
                data.conversation.messages.map((msg: any) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  events: msg.eventLog || [],
                  itinerary: msg.metadata?.itinerary || undefined,
                  metadata: msg.metadata || undefined,
                  createdAt: msg.createdAt
                })),
                data.conversation.id
              );
              setShowInitialUI(false);
              setIsPublicView(false);
              setShouldScrollToBottom(true);

              // If there's an active run, reattach streaming (refresh recovery)
              const lastAssistant = [...data.conversation.messages]
                .reverse()
                .find((m: any) => m.role === 'assistant');

              if (
                lastAssistant?.metadata?.status === 'streaming' &&
                lastAssistant?.metadata?.runId
              ) {
                resumeRunStreaming(
                  chatId,
                  lastAssistant.metadata.runId,
                  lastAssistant.id,
                  lastAssistant.content || ''
                );
                startEventSource(chatId, lastAssistant.metadata.runId, true); // Replay all events from start on refresh
              } else {
                stopEventSource(chatId);
                setActiveRun(chatId, null);
              }

              // Brief delay for smooth transition
              setTimeout(() => setIsTransitioning(false), 150);
              return;
            }
          }
        }

        // Try public endpoint
        const publicResponse = await fetch(`${baseUrl}/chat/public/${chatId}`);
        if (publicResponse.ok) {
          const data = await publicResponse.json();
          if (data.success && data.conversation) {
            setCurrentConversation(chatId);
            setMessages(
              chatId,
              data.conversation.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                events: msg.eventLog || [],
                itinerary: msg.metadata?.itinerary || undefined,
                metadata: msg.metadata || undefined,
                createdAt: msg.createdAt
              }))
            );
            setShowInitialUI(false);
            setIsPublicView(true);
            setShouldScrollToBottom(true);
            stopEventSource(chatId);
            // Brief delay for smooth transition
            setTimeout(() => setIsTransitioning(false), 150);
            return;
          }
        }

        // Conversation not found
        setError(chatId, 'Conversation not found');
        navigate('/chat');
        setIsTransitioning(false);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError(chatId, 'Failed to load conversation');
        setIsTransitioning(false);
      }
    };

    if (!isLoading) {
      loadConversation();
    }
  }, [chatId, isLoading, isAuthenticated]);

  // Cleanup all EventSources on unmount
  useEffect(() => {
    return () => {
      stopAllEventSources();
    };
  }, []);

  // Load conversation list for sidebar
  useEffect(() => {
    refreshConversations();
  }, [isAuthenticated]);

  // Re-verify auth when chat page mounts to ensure fresh state
  useEffect(() => {
    const { verify, isInitializing } = useAuthStore.getState();
    // Only re-verify if we're not in the initial load
    if (!isInitializing) {
      verify();
    }
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated and not viewing a public chat
    // Wait for both initializing and loading to complete before redirecting
    if (!isInitializing && !isLoading && !isAuthenticated && !chatId) {
      navigate('/login');
    }
  }, [isInitializing, isLoading, isAuthenticated, navigate, chatId]);

  useEffect(() => {
    // Auto-detect location only if user is authenticated, has no location saved in their profile,
    // and no location is set in the store.
    // Defer this to avoid interfering with entrance animation
    if (isAuthenticated && !user?.location && !location) {
      const timer = setTimeout(() => {
        detectLocation();
      }, 800); // Delay until after animation completes
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.location, location, detectLocation]);

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false); // Close sidebar by default on mobile
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Trigger entrance animation after auth loading completes
  useEffect(() => {
    if (isLoading) return;

    // Double requestAnimationFrame guarantees the browser has painted
    // the initial "pre" state before we start animating.
    // RAF 1: Schedules for next frame (browser will paint "pre" state)
    // RAF 2: Runs after that paint, safe to start animation
    let raf1: number;
    let raf2: number;
    let endTimer: ReturnType<typeof setTimeout>;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setAnimationState('animating');

        // Clean up animation class after it completes
        endTimer = setTimeout(() => {
          setAnimationState('done');
        }, 650);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(endTimer);
    };
  }, [isLoading]);

  // Disable browser scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && mainContentRef.current) {
      const container = mainContentRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [streamingEvents, isStreaming]);

  // Scroll to bottom when loading a conversation
  useEffect(() => {
    if (shouldScrollToBottom && messages.length > 0 && mainContentRef.current) {
      const container = mainContentRef.current;

      // First, instantly scroll to top of the container
      container.scrollTop = 0;

      // Wait a moment at the top so user can see it, then smoothly scroll to bottom
      const timer = setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
        setShouldScrollToBottom(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [shouldScrollToBottom, messages]);

  // Focus textarea after streaming completes
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming, messages.length]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const createConversation = async (): Promise<{
    id: number;
    uuid: string;
  } | null> => {
    try {
      console.log('Creating conversation...');

      const response = await fetch(`${baseUrl}/chat/new`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initialLocation: location || null
        })
      });

      if (response.status === 401) {
        console.error('401 Unauthorized - Authentication failed');

        // Try to verify auth again
        await useAuthStore.getState().verify();
        const authCheck = useAuthStore.getState().isAuthenticated;

        if (!authCheck) {
          setLocalError('Session expired. Please log in again.');
          setTimeout(() => navigate('/login'), 2000);
        }
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create conversation failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to create conversation' };
        }

        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Conversation created:', data);
      // Ensure the sidebar updates immediately (the initial sidebar fetch may have
      // happened before this conversation existed).
      refreshConversations();
      return { id: data.conversation.id, uuid: data.conversation.uuid };
    } catch (err) {
      console.error('Create conversation error:', err);

      setLocalError(
        err instanceof Error
          ? err.message
          : 'Failed to start conversation. Please try refreshing the page.'
      );
      return null;
    }
  };

  const sendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isStreaming || isPublicView) return;

    // Hide initial UI on first message
    if (showInitialUI) {
      setShowInitialUI(false);
    }

    // Create conversation if needed
    let convUuid = currentConversationUuid;
    if (!convUuid) {
      const newConv = await createConversation();
      if (!newConv) return;
      setCurrentConversation(newConv.uuid, newConv.id);
      convUuid = newConv.uuid;

      // Navigate to the new chat URL
      navigate(`/chat/${newConv.uuid}`, { replace: true });
    }

    // Add user message to UI
    addUserMessage(convUuid, trimmedInput);
    setInputValue('');

    // Start run from API, then subscribe via EventSource
    try {
      const response = await fetch(`${baseUrl}/chat/send`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationUuid: convUuid,
          message: trimmedInput,
          location: location || 'Unknown'
        })
      });

      if (response.status === 401) {
        console.error('401 Unauthorized - Session may have expired');
        // Re-verify auth state
        await useAuthStore.getState().verify();
        const authCheck = useAuthStore.getState().isAuthenticated;
        
        if (!authCheck) {
          setError(convUuid, 'Session expired. Please log in again.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to start run');
      }

      const data = await response.json();
      if (!data.success || !data.runId) {
        throw new Error(data.error || 'Failed to start run');
      }

      setActiveRun(convUuid, data.runId, data.assistantMessageId || null);
      startEventSource(convUuid, data.runId);
    } catch (err) {
      console.error('Stream error:', err);
      setError(convUuid, 'Failed to get response. Please try again.');
      stopEventSource(convUuid);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setShowInitialUI(true);
    navigate('/chat');
    setInputValue('');
  };

  // Show loading state when loading chat or auth
  if (isInitializing || isLoading || (!isAuthenticated && !chatId)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>
          {isInitializing || isLoading ? 'Loading your dashboard...' : 'Redirecting to login...'}
        </p>
      </div>
    );
  }

  const sidebarItems = [
    {
      id: 'chat',
      label: 'New Chat',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
      onClick: () => {
        setActiveView('chat');
        handleNewChat();
        closeSidebar();
      },
      active: activeView === 'chat' && !currentConversationUuid
    },
    {
      id: 'saved',
      label: 'Saved Trips',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
      onClick: () => {
        setActiveView('saved');
        navigate('/chat');
        closeSidebar();
      },
      active: activeView === 'saved'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      onClick: () => {
        setActiveView('settings');
        navigate('/chat');
        closeSidebar();
      },
      active: activeView === 'settings'
    }
  ];

  // Determine animation class based on state
  const getAnimationClass = () => {
    switch (animationState) {
      case 'pre':
        return styles.preAnimation;
      case 'animating':
        return styles.enterAnimation;
      default:
        return '';
    }
  };

  return (
    <div className={`${styles.pageContainer} ${getAnimationClass()}`}>
      <Sidebar
        items={sidebarItems}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        conversations={conversations}
        isLoadingConversations={isLoadingConversations}
        onConversationClick={(uuid) => {
          setActiveView('chat');
          navigate(`/chat/${uuid}`);
          closeSidebar();
        }}
        activeConversationUuid={currentConversationUuid}
      />
      {isMobile && sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} />
      )}
      <div
        className={`${styles.contentWrapper} ${sidebarOpen && !isMobile ? styles.sidebarExpanded : !sidebarOpen && !isMobile ? styles.sidebarMinimized : ''}`}
      >
        <Topbar
          onMenuClick={toggleSidebar}
          showMenuButton={isMobile}
          sidebarOpen={sidebarOpen}
        />

        {/* Main Content */}
        <main
          ref={mainContentRef}
          className={`${styles.mainContent} ${isTransitioning ? styles.transitioning : ''}`}
        >
          {/* Initial UI - shown when no messages */}
          {showInitialUI && messages.length === 0 && (
            <div
              className={`${styles.heroSection} ${!showInitialUI ? styles.fadeOut : ''}`}
            >
              <h1 className={styles.heroGreeting}>Explore the World.</h1>
              <LocationInput />
            </div>
          )}

          {/* Streaming/Messages View */}
          {(messages.length > 0 || isStreaming) && (
            <div className={styles.conversationView}>
              {/* Display past messages */}
              {messages.map((msg) => {
                // Skip rendering the message that's currently being streamed
                // to avoid showing duplicate "Strand" labels
                if (isStreaming && msg.id === activeAssistantMessageId) {
                  return null;
                }
                
                return (
                  <div key={msg.id} className={styles.messageBlock}>
                    {msg.role === 'user' ? (
                      <div className={styles.userMessage}>
                        <div className={styles.userLabel}>You</div>
                        <div className={styles.userMessageContent}>
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.assistantMessage}>
                        <div className={styles.assistantLabel}>Strand</div>
                        <NarrativeStream
                          events={msg.events || []}
                          isStreaming={false}
                        />
                        {msg.itinerary && (
                          <ItineraryView
                            itinerary={msg.itinerary}
                            onRefine={() => {
                              textareaRef.current?.focus();
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Active streaming */}
              {isStreaming && (
                <div className={styles.streamingContainer}>
                  <div className={styles.assistantMessage}>
                    <div className={styles.assistantLabel}>Strand</div>
                    <NarrativeStream
                      events={streamingEvents}
                      isStreaming={true}
                    />
                    {streamingItinerary && (
                      <ItineraryView itinerary={streamingItinerary} />
                    )}
                  </div>
                </div>
              )}

              {/* Error display */}
              {(error || localError) && (
                <div className={styles.errorMessage}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error || localError}</span>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input Section - always visible or as follow-up */}
          <div
            className={`${styles.inputSection} ${messages.length > 0 ? styles.followUpInput : ''}`}
          >
            <div className={styles.inputContainer}>
              <textarea
                ref={textareaRef}
                className={styles.chatInput}
                placeholder={
                  messages.length > 0
                    ? 'Ask for changes or more suggestions...'
                    : 'Describe your ideal trip...'
                }
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
              />
            </div>
            <div className={styles.actionsBar}>
              <button
                className={styles.sendButton}
                title="Send message"
                onClick={sendMessage}
                disabled={isStreaming || !inputValue.trim()}
              >
                {isStreaming ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={styles.thinkingIcon}
                  >
                    <circle cx="4" cy="12" r="2.5" />
                    <circle cx="12" cy="12" r="2.5" />
                    <circle cx="20" cy="12" r="2.5" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
