import { Link, useLocation } from 'react-router-dom';
import styles from './error.module.css';

export default function ErrorPage() {
  const location = useLocation();

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

        {/* Error Content */}
        <main className={styles.errorContent}>
          <div className={styles.errorIcon}>
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          
          <h1 className={styles.errorCode}>404</h1>
          <h2 className={styles.errorTitle}>Page Not Found</h2>
          <p className={styles.errorMessage}>
            The page <code className={styles.errorPath}>{location.pathname}</code> doesn't exist.
          </p>
          <p className={styles.errorSubtext}>
            It might have been moved or deleted, or you may have mistyped the URL.
          </p>

          <div className={styles.buttonGroup}>
            <Link to="/" className={styles.primaryButton}>
              Go Home
            </Link>
            <Link to="/demo" className={styles.secondaryButton}>
              Try Demo
            </Link>
          </div>

          {/* Helpful Links */}
          <div className={styles.helpfulLinks}>
            <h3 className={styles.linksTitle}>You might be looking for:</h3>
            <div className={styles.linkGrid}>
              <Link to="/chat" className={styles.helpLink}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Chat</span>
              </Link>
              <Link to="/pricing" className={styles.helpLink}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Pricing</span>
              </Link>
              <Link to="/demo" className={styles.helpLink}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Demo</span>
              </Link>
              <Link to="/login" className={styles.helpLink}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign In</span>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            Need help? <a href="mailto:contact@usestrand.space" className={styles.footerLink}>Contact us</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
