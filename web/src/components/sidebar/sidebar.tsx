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
  isOpen: boolean;
  onToggle: () => void;
  isMobile: boolean;
}

export default function Sidebar({ items, isOpen, onToggle, isMobile }: SidebarProps) {

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.expanded : styles.minimized} ${isMobile ? styles.mobile : ''}`}>
      <div className={styles.header}>
        {!isMobile && (
          <button 
            className={styles.toggleButton} 
            onClick={onToggle}
            aria-label={isOpen ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            {isOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>
        )}
        {isOpen && <h1 className={styles.logo}>Strand</h1>}
      </div>

      <nav className={styles.nav}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={`${styles.navItem} ${item.active ? styles.active : ''}`}
                onClick={item.onClick}
                title={!isOpen ? item.label : ''}
              >
                <span className={styles.icon}>{item.icon}</span>
                {isOpen && <span className={styles.label}>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
