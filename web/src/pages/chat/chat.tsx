import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { isAuthenticated, isLoading, user } = useAuth();
  const { location, detectLocation } = useLocationStore();
  const {
    conversationId,
    messages,
    isStreaming,
    streamingEvents,
    accumulatedResponse,
    error,
    setConversationId,
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

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

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && streamContainerRef.current) {
      streamContainerRef.current.scrollTop =
        streamContainerRef.current.scrollHeight;
    }
  }, [streamingEvents, isStreaming]);

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

  const createConversation = async (): Promise<number | null> => {
    try {
      console.log('Creating conversation...');
      console.log('User authenticated:', isAuthenticated);
      console.log('User data:', user);
      console.log('All cookies:', document.cookie);
      
      const response = await fetch(`${baseUrl}/chat/new`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.status === 401) {
        console.error('401 Unauthorized - Authentication failed');
        console.log('Attempting to re-verify authentication...');
        
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
      return data.conversation.id;
    } catch (err) {
      console.error('Create conversation error:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      setError(
        err instanceof Error ? err.message : 'Failed to start conversation. Please try refreshing the page.'
      );
      return null;
    }
  };

  const sendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isStreaming) return;

    // Hide initial UI on first message
    if (showInitialUI) {
      setShowInitialUI(false);
    }

    // Create conversation if needed
    let convId = conversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
      setConversationId(convId);
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
          conversationId: convId,
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
    setInputValue('');
  };

  if (isLoading || !isAuthenticated) {
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
      active: activeView === 'chat'
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      onClick: () => setActiveView('history'),
      active: activeView === 'history'
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
      onClick: () => setActiveView('saved'),
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
      onClick: () => setActiveView('settings'),
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
        <main className={styles.mainContent}>
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
            <div className={styles.conversationView} ref={streamContainerRef}>
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
                  <div className={styles.sendingSpinner}></div>
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
