import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import styles from './topbar.module.css';

interface TopbarProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  sidebarOpen?: boolean;
}

export default function Topbar({
  onMenuClick,
  showMenuButton = false,
  sidebarOpen = false
}: TopbarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        {showMenuButton && onMenuClick && (
          <button
            className={styles.topbarMenuButton}
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <h1
          className={`${styles.logo} ${sidebarOpen && !showMenuButton ? styles.hidden : ''}`}
        >
          Strand
        </h1>
        <div className={styles.userSection}>
          <div
            className={styles.profileContainer}
            onMouseEnter={() => setIsMenuOpen(true)}
            onMouseLeave={() => setIsMenuOpen(false)}
          >
            <button className={styles.profileButton} aria-label="User menu">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt="Profile"
                  className={styles.profileImage}
                />
              ) : (
                <div className={styles.profilePlaceholder}>{getInitials()}</div>
              )}
            </button>

            {isMenuOpen && (
              <div className={styles.dropdownMenu}>
                <div className={styles.menuSection}>
                  <div className={styles.menuEmail}>{user?.email}</div>
                </div>
                <div className={styles.menuDivider} />
                <div className={styles.menuSection}>
                  <div className={styles.menuItem}>
                    <span className={styles.menuLabel}>Plan</span>
                    <span className={styles.menuValue}>
                      {user?.plan || 'Free'}
                    </span>
                  </div>
                  <div className={styles.menuItem}>
                    <span className={styles.menuLabel}>Credits</span>
                    <span className={styles.menuValue}>
                      {user?.credits || 0}
                    </span>
                  </div>
                </div>
                <div className={styles.menuDivider} />
                <button
                  className={styles.menuButton}
                  onClick={() => navigate('/settings')}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Settings
                </button>
                <button className={styles.menuButton} onClick={handleLogout}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
