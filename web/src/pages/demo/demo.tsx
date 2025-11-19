import { Link } from 'react-router-dom';
import { useState } from 'react';
import styles from './demo.module.css';

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const demoSteps = [
    {
      title: 'Tell us where you want to go',
      placeholder: 'E.g., "Plan a weekend trip to San Francisco"',
      response: 'Great! I\'ll help you plan an amazing weekend in San Francisco. Let me search for the best spots...'
    },
    {
      title: 'AI analyzes thousands of places',
      placeholder: '',
      response: 'Found 247 restaurants, 89 attractions, and 34 activities that match your preferences.'
    },
    {
      title: 'Get your personalized itinerary',
      placeholder: '',
      response: 'Here\'s your custom 2-day San Francisco adventure with optimized routes and timing!'
    }
  ];

  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      title: 'AI-Powered Planning',
      description: 'Our AI analyzes millions of data points to create the perfect itinerary for you.'
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: 'Time Optimized',
      description: 'Smart routing ensures you spend less time traveling and more time exploring.'
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      title: 'Local Insights',
      description: 'Discover hidden gems and local favorites based on real reviews and ratings.'
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      title: 'Collaborative',
      description: 'Share and plan trips with friends, family, or colleagues seamlessly.'
    }
  ];

  const handleNextStep = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setInputValue('');
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Header */}
        <header className={styles.header}>
          <Link to="/" className={styles.logo}>
            Strand
          </Link>
          <nav className={styles.nav}>
            <Link to="/demo" className={styles.navLink}>Demo</Link>
            <Link to="/pricing" className={styles.navLink}>Pricing</Link>
            <Link to="/login" className={styles.loginButton}>Sign In</Link>
          </nav>
        </header>

        {/* Hero Section */}
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>See Strand in Action</h1>
          <p className={styles.heroSubtitle}>
            Experience how our AI creates personalized travel itineraries in seconds.
          </p>
        </section>

        {/* Interactive Demo */}
        <section className={styles.demoSection}>
          <div className={styles.demoCard}>
            <div className={styles.demoHeader}>
              <div className={styles.stepIndicator}>
                {demoSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`${styles.stepDot} ${index <= currentStep ? styles.active : ''}`}
                  />
                ))}
              </div>
              <h2 className={styles.demoTitle}>{demoSteps[currentStep].title}</h2>
            </div>

            <div className={styles.demoBody}>
              {currentStep === 0 && (
                <div className={styles.inputSection}>
                  <input
                    type="text"
                    className={styles.demoInput}
                    placeholder={demoSteps[currentStep].placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <button 
                    className={styles.demoSendButton}
                    onClick={handleNextStep}
                    disabled={!inputValue}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              )}

              {currentStep > 0 && (
                <div className={styles.responseSection}>
                  <div className={styles.aiResponse}>
                    <div className={styles.aiAvatar}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <p className={styles.aiText}>{demoSteps[currentStep].response}</p>
                  </div>
                  
                  {currentStep === 2 && (
                    <div className={styles.itineraryPreview}>
                      <div className={styles.itineraryDay}>
                        <h3 className={styles.dayTitle}>Day 1 - Saturday</h3>
                        <div className={styles.activityList}>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>9:00 AM</span>
                            <span className={styles.activityName}>Golden Gate Bridge</span>
                          </div>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>11:30 AM</span>
                            <span className={styles.activityName}>Fisherman's Wharf</span>
                          </div>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>1:00 PM</span>
                            <span className={styles.activityName}>Lunch at Pier 39</span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.itineraryDay}>
                        <h3 className={styles.dayTitle}>Day 2 - Sunday</h3>
                        <div className={styles.activityList}>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>10:00 AM</span>
                            <span className={styles.activityName}>Alcatraz Island Tour</span>
                          </div>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>2:00 PM</span>
                            <span className={styles.activityName}>Chinatown Exploration</span>
                          </div>
                          <div className={styles.activity}>
                            <span className={styles.activityTime}>7:00 PM</span>
                            <span className={styles.activityName}>Sunset at Twin Peaks</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.demoFooter}>
              <button 
                className={styles.navButton}
                onClick={handlePrevStep}
                disabled={currentStep === 0}
              >
                Previous
              </button>
              {currentStep < demoSteps.length - 1 ? (
                <button 
                  className={styles.navButton}
                  onClick={handleNextStep}
                >
                  Next
                </button>
              ) : (
                <Link to="/signup" className={styles.startButton}>
                  Start Planning
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className={styles.featuresSection}>
          <h2 className={styles.featuresTitle}>Why Choose Strand?</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>Ready to Start Planning?</h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of travelers creating perfect itineraries with Strand.
          </p>
          <div className={styles.ctaButtons}>
            <Link to="/signup" className={styles.primaryCta}>Get Started Free</Link>
            <Link to="/pricing" className={styles.secondaryCta}>View Pricing</Link>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            Questions? <a href="mailto:contact@usestrand.space" className={styles.footerLink}>Contact us</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
