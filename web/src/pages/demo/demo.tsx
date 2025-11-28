import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import styles from './demo.module.css';
import Navbar from '@/components/navbar/navbar';
import Footer from '@/components/footer/footer';

interface DemoMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string[];
  places?: PlaceResult[];
}

interface PlaceResult {
  name: string;
  type: string;
  rating: number;
  priceLevel: string;
  distance: string;
  highlight: string;
}

const demoConversation: DemoMessage[] = [
  {
    id: 1,
    role: 'user',
    content: "I'm looking for a romantic date night in downtown. Budget around $150, we like Italian food and want something memorable."
  },
  {
    id: 2,
    role: 'assistant',
    content: "I found the perfect evening for you! Here's what I'm thinking...",
    thinking: [
      'Searching 847 restaurants within 2 miles of downtown...',
      'Filtering for Italian cuisine with 4.5+ stars...',
      'Analyzing 2,341 recent reviews for romantic ambiance...',
      'Checking reservation availability for tonight...',
      'Optimizing route for a memorable evening experience...'
    ],
    places: [
      {
        name: "Lucia's Trattoria",
        type: 'Italian Restaurant',
        rating: 4.8,
        priceLevel: '$$$',
        distance: '0.3 mi',
        highlight: 'Candlelit courtyard seating, homemade pasta'
      },
      {
        name: 'Riverside Wine Bar',
        type: 'Wine Bar',
        rating: 4.7,
        priceLevel: '$$',
        distance: '0.1 mi from dinner',
        highlight: 'Perfect for after-dinner drinks with city views'
      },
      {
        name: 'Moonlight Garden Walk',
        type: 'Park',
        rating: 4.9,
        priceLevel: 'Free',
        distance: '0.2 mi',
        highlight: 'Lit pathways, fountain, ends near parking'
      }
    ]
  }
];

const examplePrompts = [
  {
    icon: '🍽️',
    title: 'Date Night',
    prompt: 'Plan a romantic dinner date downtown, budget $100-150'
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: 'Family Day',
    prompt: 'Fun activities for kids under 10, outdoor preferred'
  },
  {
    icon: '☕',
    title: 'Work Session',
    prompt: 'Best cafes for working, need good wifi and outlets'
  },
  {
    icon: '🎉',
    title: 'Night Out',
    prompt: 'Bar hopping route for a group of 6, craft cocktails'
  }
];

export default function DemoPage() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentThinkingStep, setCurrentThinkingStep] = useState(0);
  const [showPlaces, setShowPlaces] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentThinkingStep, showPlaces]);

  const simulateConversation = async (userMessage: string) => {
    setHasStarted(true);
    setMessages([{ id: 1, role: 'user', content: userMessage }]);
    setIsTyping(true);
    setCurrentThinkingStep(0);
    setShowPlaces(false);

    const thinkingSteps = demoConversation[1].thinking || [];
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setMessages(prev => [...prev, {
      id: 2,
      role: 'assistant',
      content: demoConversation[1].content,
      thinking: thinkingSteps,
      places: demoConversation[1].places
    }]);

    for (let i = 0; i < thinkingSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setCurrentThinkingStep(i + 1);
    }

    await new Promise(resolve => setTimeout(resolve, 400));
    setShowPlaces(true);
    setIsTyping(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      simulateConversation(inputValue.trim());
      setInputValue('');
    }
  };

  const handleExampleClick = (prompt: string) => {
    simulateConversation(prompt);
  };

  const resetDemo = () => {
    setMessages([]);
    setHasStarted(false);
    setCurrentThinkingStep(0);
    setShowPlaces(false);
    setIsTyping(false);
  };

  return (
    <div className={styles.pageContainer}>
      <Navbar />

      <div className={styles.contentWrapper}>
        <div className={styles.hero}>
          <div className={styles.badge}>
            <span className={styles.badgeDot}></span>
            Live Demo
          </div>
          <h1 className={styles.heroTitle}>
            Your Local AI Travel Agent
          </h1>
          <p className={styles.heroSubtitle}>
            Tell me what you're looking for. I'll search through maps, reviews, and local insights 
            to find exactly what you need.
          </p>
        </div>

        <div className={styles.chatContainer}>
          <div className={styles.chatWindow}>
            {!hasStarted && (
              <div className={styles.emptyState}>
                <div className={styles.aiAvatarLarge}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h3 className={styles.emptyTitle}>Hi! I'm your local guide.</h3>
                <p className={styles.emptyText}>
                  I know every restaurant, cafe, bar, and hidden gem in your area. 
                  Tell me what you're planning and I'll find the perfect spots.
                </p>
                
                <div className={styles.exampleGrid}>
                  {examplePrompts.map((example, index) => (
                    <button
                      key={index}
                      className={styles.exampleCard}
                      onClick={() => handleExampleClick(example.prompt)}
                    >
                      <span className={styles.exampleIcon}>{example.icon}</span>
                      <span className={styles.exampleTitle}>{example.title}</span>
                      <span className={styles.examplePrompt}>{example.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasStarted && (
              <div className={styles.messagesContainer}>
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                  >
                    {msg.role === 'user' ? (
                      <div className={styles.userBubble}>
                        <p>{msg.content}</p>
                      </div>
                    ) : (
                      <div className={styles.assistantContent}>
                        <div className={styles.aiAvatar}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                        <div className={styles.assistantBubble}>
                          <p className={styles.assistantText}>{msg.content}</p>
                          
                          {msg.thinking && currentThinkingStep > 0 && (
                            <div className={styles.thinkingContainer}>
                              {msg.thinking.slice(0, currentThinkingStep).map((step, index) => (
                                <div 
                                  key={index} 
                                  className={`${styles.thinkingStep} ${index === currentThinkingStep - 1 && isTyping ? styles.active : ''}`}
                                >
                                  <div className={styles.thinkingIcon}>
                                    {index < currentThinkingStep - 1 || !isTyping ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    ) : (
                                      <div className={styles.spinner}></div>
                                    )}
                                  </div>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {msg.places && showPlaces && (
                            <div className={styles.placesContainer}>
                              <div className={styles.placesHeader}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>Your Perfect Evening</span>
                              </div>
                              <div className={styles.timeline}>
                                {msg.places.map((place, index) => (
                                  <div key={index} className={styles.placeCard}>
                                    <div className={styles.timelineMarker}>
                                      <div className={styles.markerDot}>{index + 1}</div>
                                      {index < msg.places!.length - 1 && <div className={styles.markerLine}></div>}
                                    </div>
                                    <div className={styles.placeContent}>
                                      <div className={styles.placeHeader}>
                                        <h4 className={styles.placeName}>{place.name}</h4>
                                        <span className={styles.placeRating}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                          </svg>
                                          {place.rating}
                                        </span>
                                      </div>
                                      <div className={styles.placeMeta}>
                                        <span className={styles.placeType}>{place.type}</span>
                                        <span className={styles.placeDot}>•</span>
                                        <span className={styles.placePrice}>{place.priceLevel}</span>
                                        <span className={styles.placeDot}>•</span>
                                        <span className={styles.placeDistance}>{place.distance}</span>
                                      </div>
                                      <p className={styles.placeHighlight}>{place.highlight}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className={styles.totalEstimate}>
                                <span>Estimated Total:</span>
                                <span className={styles.totalAmount}>$95 - $130</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            <div className={styles.inputArea}>
              {hasStarted && (
                <button className={styles.resetButton} onClick={resetDemo}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  New Chat
                </button>
              )}
              <form onSubmit={handleSubmit} className={styles.inputForm}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Tell me what you're looking for..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isTyping}
                />
                <button 
                  type="submit" 
                  className={styles.sendButton}
                  disabled={!inputValue.trim() || isTyping}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          </div>

          <div className={styles.sideInfo}>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <h4>Deep Local Search</h4>
              <p>We search Google Maps, Yelp, Reddit, and local blogs to find the best spots.</p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </div>
              <h4>Personalized Plans</h4>
              <p>Tell us your budget, preferences, and constraints. We'll handle the rest.</p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" x2="12" y1="2" y2="15" />
                </svg>
              </div>
              <h4>Share Instantly</h4>
              <p>Send your plan to friends with a single link. Everyone stays on the same page.</p>
            </div>
          </div>
        </div>

        <div className={styles.ctaSection}>
          <h2>Ready to explore your city?</h2>
          <p>Create your free account and start planning.</p>
          <div className={styles.ctaButtons}>
            <Link to="/signup" className={styles.ctaPrimary}>
              Get Started Free
            </Link>
            <Link to="/pricing" className={styles.ctaSecondary}>
              View Pricing
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
