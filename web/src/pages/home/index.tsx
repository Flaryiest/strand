import styles from './index.module.css';

import { Link } from 'react-router-dom';
import Navbar from '@components/navbar/navbar';
import Footer from '@components/footer/footer';

export default function IndexPage() {
  return (
    <div className={styles.pageContainer}>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.hero}>
          <h1 className={styles.title}>The AI for Adventure</h1>
          <p className={styles.subtitle}>
            Find the best food, best stores, best locations for all your needs.
          </p>
          <Link className={styles.ctaButton} to="/demo">
            Get Started
          </Link>
          <img src="/landing/maps.jpg" className={styles.heroImage} />
        </div>
        <div className={styles.featureSection}>
          <h2 className={styles.featureTitle}>Prompt to plan in seconds.</h2>
          <h3 className={styles.featureSubtitle}>
            3 Simple Steps to create your perfect journey.
          </h3>
          <div className={styles.featureCardContainer}>
            <div className={styles.featureColumnOne}>
              <div className={styles.featureOne}>
                <svg
                  className={styles.featureImage}
                  viewBox="0 0 400 300"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Chat bubble */}
                  <rect
                    x="40"
                    y="40"
                    width="320"
                    height="100"
                    rx="16"
                    fill="rgba(139, 154, 126, 0.08)"
                    stroke="rgba(139, 154, 126, 0.3)"
                    strokeWidth="2"
                  />
                  {/* Text lines */}
                  <line
                    x1="70"
                    y1="70"
                    x2="250"
                    y2="70"
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="70"
                    y1="90"
                    x2="200"
                    y2="90"
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <line
                    x1="70"
                    y1="110"
                    x2="280"
                    y2="110"
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  
                  {/* AI response bubble */}
                  <rect
                    x="60"
                    y="165"
                    width="280"
                    height="95"
                    rx="16"
                    fill="white"
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth="2"
                  />
                  
                  {/* Location pins */}
                  <g transform="translate(90, 185)">
                    <path
                      d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
                      fill="#8b9a7e"
                    />
                  </g>
                  <g transform="translate(160, 185)">
                    <path
                      d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
                      fill="#6b7a5f"
                    />
                  </g>
                  <g transform="translate(230, 185)">
                    <path
                      d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20c0-6.6-5.4-12-12-12zm0 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
                      fill="#8b9a7e"
                    />
                  </g>
                  
                  {/* Connecting lines */}
                  <line
                    x1="102"
                    y1="205"
                    x2="172"
                    y2="205"
                    stroke="rgba(139, 154, 126, 0.3)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="184"
                    y1="205"
                    x2="242"
                    y2="205"
                    stroke="rgba(139, 154, 126, 0.3)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  
                  {/* Sparkles for AI magic */}
                  <g transform="translate(310, 180)">
                    <path
                      d="M0 5 L1.5 1.5 L5 0 L1.5 -1.5 L0 -5 L-1.5 -1.5 L-5 0 L-1.5 1.5 Z"
                      fill="#8b9a7e"
                      opacity="0.6"
                    />
                  </g>
                  <g transform="translate(295, 210)">
                    <path
                      d="M0 3.5 L1 1 L3.5 0 L1 -1 L0 -3.5 L-1 -1 L-3.5 0 L-1 1 Z"
                      fill="#6b7a5f"
                      opacity="0.4"
                    />
                  </g>
                </svg>
                <div className={styles.featureOneText}>
                  <h4 className={styles.featureOneTitle}>
                    Describe your ideal trip
                  </h4>
                  <p className={styles.featureOneDescription}>
                    We'll do the rest. Combing through maps, reddit threads and
                    much more for reviews, price, and the optimal distance.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.featureColumnTwo}>
              <div className={styles.featureTwo}>
                <div className={styles.featureTwoContent}>
                  <h4 className={styles.featureTwoTitle}>Share with friends</h4>
                  <p className={styles.featureTwoDescription}>
                    Collaborate on plans and get everyone's input. Share your
                    itinerary instantly and make group decisions effortless.
                  </p>
                </div>
                <svg
                  className={styles.featureTwoImage}
                  viewBox="0 0 200 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="40" cy="40" r="22" fill="rgba(0,0,0,0.08)" />
                  <circle cx="100" cy="40" r="22" fill="rgba(0,0,0,0.12)" />
                  <circle cx="160" cy="40" r="22" fill="rgba(0,0,0,0.08)" />
                  <circle cx="40" cy="40" r="16" fill="rgba(0,0,0,0.15)" />
                  <circle cx="100" cy="40" r="16" fill="rgba(0,0,0,0.2)" />
                  <circle cx="160" cy="40" r="16" fill="rgba(0,0,0,0.15)" />
                  <line
                    x1="62"
                    y1="40"
                    x2="78"
                    y2="40"
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <line
                    x1="122"
                    y1="40"
                    x2="138"
                    y2="40"
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="40" cy="40" r="6" fill="white" opacity="0.8" />
                  <circle cx="100" cy="40" r="6" fill="white" opacity="0.8" />
                  <circle cx="160" cy="40" r="6" fill="white" opacity="0.8" />
                </svg>
              </div>
              <div className={styles.featureThree}>
                <div className={styles.featureThreeContent}>
                  <h4 className={styles.featureThreeTitle}>
                    Enjoy your journey
                  </h4>
                  <p className={styles.featureThreeDescription}>
                    Hit the road with confidence. Your personalized plan adapts
                    to your pace, preferences, and spontaneous discoveries.
                  </p>
                </div>
                <svg
                  className={styles.featureThreeImage}
                  viewBox="0 0 200 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 50 L50 25 L80 40 L110 20 L140 35 L170 30"
                    stroke="rgba(0,0,0,0.12)"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20 50 L50 25 L80 40 L110 20 L140 35 L170 30"
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <circle cx="20" cy="50" r="8" fill="rgba(0,0,0,0.15)" />
                  <circle cx="50" cy="25" r="8" fill="rgba(0,0,0,0.2)" />
                  <circle cx="80" cy="40" r="8" fill="rgba(0,0,0,0.15)" />
                  <circle cx="110" cy="20" r="8" fill="rgba(0,0,0,0.2)" />
                  <circle cx="140" cy="35" r="8" fill="rgba(0,0,0,0.15)" />
                  <circle cx="170" cy="30" r="8" fill="rgba(0,0,0,0.2)" />
                  <circle cx="20" cy="50" r="3" fill="white" opacity="0.9" />
                  <circle cx="50" cy="25" r="3" fill="white" opacity="0.9" />
                  <circle cx="110" cy="20" r="3" fill="white" opacity="0.9" />
                  <circle cx="170" cy="30" r="3" fill="white" opacity="0.9" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
