import { useState } from 'react';
import styles from './sidebar.module.css';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  defaultExpanded?: boolean;
}

export default function Sidebar({ items, defaultExpanded = true }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.minimized}`}>
      <div className={styles.header}>
        <button 
          className={styles.toggleButton} 
          onClick={toggleSidebar}
          aria-label={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>
        {isExpanded && <h2 className={styles.title}>Menu</h2>}
      </div>

      <nav className={styles.nav}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={`${styles.navItem} ${item.active ? styles.active : ''}`}
                onClick={item.onClick}
                title={!isExpanded ? item.label : ''}
              >
                <span className={styles.icon}>{item.icon}</span>
                {isExpanded && <span className={styles.label}>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
