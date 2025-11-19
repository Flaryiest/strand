import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLocationStore } from '@/stores/location';
import { useChatStore } from '@/stores/chat';
import { createConversation, streamChatMessage } from '@/utils/chatService';
import Sidebar from '@/components/sidebar/sidebar';
import Topbar from '@/components/topbar/topbar';
import LocationInput from '@/components/locationInput/locationInput';
import styles from './chat.module.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { location, detectLocation } = useLocationStore();
  const { conversationId, setConversationId, addUserMessage, setError } = useChatStore();
  const [activeView, setActiveView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && !user?.location && !location) {
      detectLocation();
    }
  }, [isAuthenticated, user?.location, location, detectLocation]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => { if (isMobile) setSidebarOpen(false); };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const newConversation = await createConversation();
        currentConversationId = newConversation.id;
        setConversationId(currentConversationId);
      }
      addUserMessage(inputValue);
      const messageText = inputValue;
      setInputValue('');
      
      const response = await streamChatMessage(currentConversationId, messageText);
      
      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server error: ${response.status}`);
      }

      // Handle streaming response (SSE)
      if (!response.body) {
        throw new Error('No response body');
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
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') {
            console.log('Stream completed');
            continue;
          }

          try {
            const eventData = JSON.parse(data);
            console.log('Stream event:', eventData);
            // TODO: Update UI with streaming events using addStreamEvent()
          } catch (e) {
            console.warn('Failed to parse SSE data:', data);
          }
        }
      }

      console.log('Message sent successfully');
    } catch (error) {
      console.error('Failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const sidebarItems = [
    {
      id: 'chat',
      label: 'New Chat',
      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>),
      onClick: () => setActiveView('chat'),
      active: activeView === 'chat'
    }
  ];

  return (
    <div className={`${styles.pageContainer} ${isEntering ? styles.enterAnimation : ''}`}>
      <Sidebar items={sidebarItems} isOpen={sidebarOpen} onToggle={toggleSidebar} isMobile={isMobile} />
      {isMobile && sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} />}
      <div className={`${styles.contentWrapper} ${sidebarOpen && !isMobile ? styles.sidebarExpanded : !sidebarOpen && !isMobile ? styles.sidebarMinimized : ''}`}>
        <Topbar onMenuClick={toggleSidebar} showMenuButton={isMobile} sidebarOpen={sidebarOpen} />
        <main className={styles.mainContent}>
          <div className={styles.heroSection}>
            <h1 className={styles.heroGreeting}>Explore the World.</h1>
            <LocationInput />
          </div>
          <div className={styles.inputSection}>
            <div className={styles.inputContainer}>
              <textarea
                ref={textareaRef}
                className={styles.chatInput}
                placeholder="Describe your ideal trip..."
                rows={1}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isSending}
              />
            </div>
            <div className={styles.actionsBar}>
              <button 
                className={styles.sendButton} 
                onClick={handleSendMessage}
                disabled={isSending || !inputValue.trim()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
