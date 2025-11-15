import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './chat.module.css';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>Strand</h1>
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{user?.email}</span>
              <span className={styles.userPlan}>{user?.plan} Plan</span>
            </div>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.welcomeSection}>
          <h2 className={styles.welcomeTitle}>Welcome to Strand AI</h2>
          <p className={styles.welcomeSubtitle}>
            Start planning your perfect adventure by describing your ideal trip
          </p>
        </div>

        {/* Placeholder for Chat Interface */}
        <div className={styles.chatContainer}>
          <div className={styles.chatPlaceholder}>
            <div className={styles.placeholderIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor" opacity="0.3"/>
                <path d="M13 7H11V13H17V11H13V7Z" fill="currentColor"/>
              </svg>
            </div>
            <h3 className={styles.placeholderTitle}>Chat Interface Coming Soon</h3>
            <p className={styles.placeholderText}>
              This is where you'll interact with Strand AI to plan your trips, get recommendations, and create custom itineraries.
            </p>
            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🗺️</span>
                <span>AI-powered location recommendations</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>📍</span>
                <span>Interactive route planning</span>
              </div>
              <div className={styles.featureItem}>
                <span className={styles.featureIcon}>🔗</span>
                <span>Shareable itineraries</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Stats */}
        <div className={styles.statsSection}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Credits Remaining</div>
            <div className={styles.statValue}>{user?.credits || 0}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Plan Type</div>
            <div className={styles.statValue}>{user?.plan}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
