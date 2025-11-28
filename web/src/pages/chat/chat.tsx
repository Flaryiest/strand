import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { baseUrl } from '@/utils/baseUrl';
import { useLocationStore } from '@/stores/location';
import { useChatStore } from '@/stores/chat';
import Sidebar from '@/components/sidebar/sidebar';
import Topbar from '@/components/topbar/topbar';
import LocationInput from '@/components/locationInput/locationInput';
import ReasoningStream from '@/components/reasoningStream/reasoningStream';
import styles from './chat.module.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { location, detectLocation } = useLocationStore();
  const {
    conversationUuid,
    messages,
    isStreaming,
    streamingEvents,
    accumulatedResponse,
    error,
    conversations,
    isLoadingConversations,
    setConversationId,
    setConversationUuid,
    setConversations,
    setLoadingConversations,
    setMessages,
    addUserMessage,
    addStreamEvent,
    completeStreaming,
    setError,
    reset
  } = useChatStore();

  const [activeView, setActiveView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showInitialUI, setShowInitialUI] = useState(true);
  const [isPublicView, setIsPublicView] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation from URL if chatId is present
  useEffect(() => {
    const loadConversation = async () => {
      if (!chatId) {
        // No chatId in URL, show fresh chat
        if (conversationUuid) {
          reset();
        }
        setShowInitialUI(true);
        return;
      }

      // Check if we already have this conversation loaded
      if (conversationUuid === chatId && messages.length > 0) {
        setShowInitialUI(false);
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
              setConversationId(data.conversation.id);
              setConversationUuid(data.conversation.uuid);
              setMessages(data.conversation.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                events: msg.eventLog || [],
                createdAt: msg.createdAt
              })));
              setShowInitialUI(false);
              setIsPublicView(false);
              setShouldScrollToBottom(true);
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
            setConversationUuid(data.conversation.uuid);
            setMessages(data.conversation.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              events: msg.eventLog || [],
              createdAt: msg.createdAt
            })));
            setShowInitialUI(false);
            setIsPublicView(true);
            setShouldScrollToBottom(true);
            // Brief delay for smooth transition
            setTimeout(() => setIsTransitioning(false), 150);
            return;
          }
        }

        // Conversation not found
        setError('Conversation not found');
        navigate('/chat');
        setIsTransitioning(false);
      } catch (err) {
        console.error('Error loading conversation:', err);
        setError('Failed to load conversation');
        setIsTransitioning(false);
      }
    };

    if (!isLoading) {
      loadConversation();
    }
  }, [chatId, isLoading, isAuthenticated]);

  // Load conversation list for sidebar
  useEffect(() => {
    const loadConversations = async () => {
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

    loadConversations();
  }, [isAuthenticated]);

  useEffect(() => {
    // Redirect to login if not authenticated and not viewing a public chat
    if (!isLoading && !isAuthenticated && !chatId) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate, chatId]);

  useEffect(() => {
    // Auto-detect location only if user is authenticated, has no location saved in their profile,
    // and no location is set in the store
    if (isAuthenticated && !user?.location && !location) {
      detectLocation();
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

  // Trigger entrance animation on mount
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsEntering(false);
      }
    }, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Disable browser scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant'
      });
    }
  }, [streamingEvents, isStreaming]);

  // Scroll to bottom when loading a conversation
  useEffect(() => {
    if (shouldScrollToBottom && messages.length > 0) {
      // Temporarily disable smooth scroll behavior on html element
      const htmlElement = document.documentElement;
      const originalScrollBehavior = htmlElement.style.scrollBehavior;
      htmlElement.style.scrollBehavior = 'auto';
      
      // First scroll to top instantly
      window.scrollTo(0, 0);
      
      // Force the scroll position to stay at top
      const preventScroll = () => {
        window.scrollTo(0, 0);
      };
      window.addEventListener('scroll', preventScroll);
      
      // Use setTimeout to let the DOM settle, then animate
      setTimeout(() => {
        // Remove the scroll lock
        window.removeEventListener('scroll', preventScroll);
        
        // Restore scroll behavior for smooth animation
        htmlElement.style.scrollBehavior = originalScrollBehavior;
        
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
        
        setShouldScrollToBottom(false);
      }, 150);
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

  const createConversation = async (): Promise<{ id: number; uuid: string } | null> => {
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
          setError('Session expired. Please log in again.');
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
      return { id: data.conversation.id, uuid: data.conversation.uuid };
    } catch (err) {
      console.error('Create conversation error:', err);
      
      setError(
        err instanceof Error ? err.message : 'Failed to start conversation. Please try refreshing the page.'
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
    let convUuid = conversationUuid;
    if (!convUuid) {
      const newConv = await createConversation();
      if (!newConv) return;
      setConversationId(newConv.id);
      setConversationUuid(newConv.uuid);
      convUuid = newConv.uuid;
      
      // Navigate to the new chat URL
      navigate(`/chat/${newConv.uuid}`, { replace: true });
    }

    // Add user message to UI
    addUserMessage(trimmedInput);
    setInputValue('');

    // Start streaming from API
    try {
      const response = await fetch(`${baseUrl}/chat/stream`, {
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

      if (!response.ok || !response.body) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));

              if (eventData.type === 'done') {
                completeStreaming();
              } else {
                addStreamEvent(eventData);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
      setError('Failed to get response. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleNewChat = () => {
    reset();
    setShowInitialUI(true);
    navigate('/chat');
    setInputValue('');
  };

  // Show loading state when loading chat or auth
  if (isLoading || (!isAuthenticated && !chatId)) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>
          {isLoading ? 'Loading your dashboard...' : 'Redirecting to login...'}
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
      },
      active: activeView === 'chat' && !conversationUuid
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
      },
      active: activeView === 'settings'
    }
  ];

  return (
    <div
      className={`${styles.pageContainer} ${isEntering ? styles.enterAnimation : ''}`}
    >
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
        }}
        activeConversationUuid={conversationUuid}
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
        <main className={`${styles.mainContent} ${isTransitioning ? styles.transitioning : ''}`}>
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
              {messages.map((msg) => (
                <div key={msg.id} className={styles.messageBlock}>
                  {msg.role === 'user' ? (
                    <div className={styles.userMessage}>
                      <div className={styles.userMessageIcon}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className={styles.userMessageContent}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <ReasoningStream
                      events={msg.events || []}
                      accumulatedResponse={msg.content}
                    />
                  )}
                </div>
              ))}

              {/* Active streaming */}
              {isStreaming && (
                <ReasoningStream
                  events={streamingEvents}
                  accumulatedResponse={accumulatedResponse}
                />
              )}

              {/* Error display */}
              {error && (
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
                  <span>{error}</span>
                </div>
              )}
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
