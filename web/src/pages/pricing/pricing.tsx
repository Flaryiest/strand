import { Link } from 'react-router-dom';
import styles from './pricing.module.css';

export default function PricingPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* Header */}
        <header className={styles.header}>
          <Link to="/" className={styles.logo}>
            Strand
          </Link>
          <nav className={styles.nav}>
            <Link to="/demo" className={styles.navLink}>
              Demo
            </Link>
            <Link to="/pricing" className={styles.navLink}>
              Pricing
            </Link>
            <Link to="/login" className={styles.loginButton}>
              Sign In
            </Link>
          </nav>
        </header>

        {/* Hero Section */}
        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>Simple, Transparent Pricing</h1>
          <p className={styles.heroSubtitle}>
            Choose the plan that works best for you. All plans include access to
            our AI-powered trip planning.
          </p>
        </section>

        {/* Pricing Cards */}
        <section className={styles.pricingGrid}>
          {/* Free Tier */}
          <div className={styles.pricingCard}>
            <div className={styles.cardHeader}>
              <div className={styles.planBadge}>Beta</div>
              <h2 className={styles.planName}>Free</h2>
              <div className={styles.priceContainer}>
                <span className={styles.price}>$0</span>
                <span className={styles.period}>/month</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.includesTitle}>Includes</h3>
              <ul className={styles.featureList}>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  100 starter credits
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Access to Chat mode
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Access to Workflows
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Direct access to founders
                </li>
              </ul>
              <Link to="/signup" className={styles.ctaButton}>
                Get Started
              </Link>
            </div>
          </div>

          {/* Pro Tier */}
          <div className={`${styles.pricingCard} ${styles.featured}`}>
            <div className={styles.popularBadge}>Most Popular</div>
            <div className={styles.cardHeader}>
              <div className={styles.planBadge}>Beta</div>
              <h2 className={styles.planName}>Pro</h2>
              <div className={styles.priceContainer}>
                <span className={styles.price}>$16</span>
                <span className={styles.period}>/month</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.includesTitle}>Everything in Free, plus</h3>
              <ul className={styles.featureList}>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  2,000 credits per month
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  100 daily refresh credits
                </li>
                <li className={`${styles.feature} ${styles.highlighted}`}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  +2,000 extra credits per month
                  <span className={styles.limitedOffer}>limited offer</span>
                </li>
              </ul>
              <Link
                to="/signup"
                className={`${styles.ctaButton} ${styles.primaryButton}`}
              >
                Start Pro Trial
              </Link>
            </div>
          </div>

          {/* Business Tier */}
          <div className={styles.pricingCard}>
            <div className={styles.cardHeader}>
              <div className={styles.planBadge}>Beta</div>
              <h2 className={styles.planName}>Group / Business</h2>
              <div className={styles.priceContainer}>
                <span className={styles.price}>Custom</span>
                <span className={styles.period}>pricing</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.includesTitle}>Everything in Pro, plus</h3>
              <ul className={styles.featureList}>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Custom credit allocation
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Team collaboration tools
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Custom integrations
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Increased agent iterations
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Priority support
                </li>
                <li className={styles.feature}>
                  <svg
                    className={styles.checkIcon}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Dedicated account manager
                </li>
              </ul>
              <a
                href="mailto:contact@usestrand.space"
                className={styles.ctaButton}
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>What are credits?</h3>
              <p className={styles.faqAnswer}>
                Credits are used for AI-powered trip planning requests. Each
                request consumes credits based on complexity and length.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>
                Can I upgrade or downgrade anytime?
              </h3>
              <p className={styles.faqAnswer}>
                Yes! You can upgrade or downgrade your plan at any time. Changes
                take effect immediately.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>
                What happens if I run out of credits?
              </h3>
              <p className={styles.faqAnswer}>
                You can purchase additional credits or upgrade to a higher tier.
                Free users can wait for the next month's allocation.
              </p>
            </div>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>Is there a refund policy?</h3>
              <p className={styles.faqAnswer}>
                Yes, we offer a 14-day money-back guarantee for all paid plans.
                No questions asked.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            Questions?{' '}
            <a
              href="mailto:contact@usestrand.space"
              className={styles.footerLink}
            >
              Contact us
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
