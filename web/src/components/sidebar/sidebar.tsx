import styles from './sidebar.module.css';
import { GroupedConversations, ConversationSummary } from '@/stores/chat';

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
  conversations?: GroupedConversations;
  isLoadingConversations?: boolean;
  onConversationClick?: (uuid: string) => void;
  activeConversationUuid?: string | null;
}

interface ConversationGroupProps {
  title: string;
  conversations: ConversationSummary[];
  isOpen: boolean;
  onConversationClick?: (uuid: string) => void;
  activeUuid?: string | null;
}

function ConversationGroup({ title, conversations, isOpen, onConversationClick, activeUuid }: ConversationGroupProps) {
  if (conversations.length === 0) return null;
  
  return (
    <div className={styles.conversationGroup}>
      {isOpen && <h3 className={styles.groupTitle}>{title}</h3>}
      <ul className={styles.conversationList}>
        {conversations.map((conv) => (
          <li key={conv.uuid}>
            <button
              className={`${styles.conversationItem} ${activeUuid === conv.uuid ? styles.active : ''}`}
              onClick={() => onConversationClick?.(conv.uuid)}
              title={!isOpen ? conv.title : ''}
            >
              <span className={styles.icon}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              {isOpen && <span className={styles.conversationTitle}>{conv.title}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({
  items,
  isOpen,
  onToggle,
  isMobile,
  conversations,
  isLoadingConversations,
  onConversationClick,
  activeConversationUuid
}: SidebarProps) {
  const hasConversations = conversations && (
    conversations.today.length > 0 ||
    conversations.yesterday.length > 0 ||
    conversations.last7Days.length > 0 ||
    conversations.last30Days.length > 0 ||
    conversations.older.length > 0
  );

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles.expanded : styles.minimized} ${isMobile ? styles.mobile : ''}`}
    >
      <div className={styles.header}>
        {!isMobile && (
          <button
            className={styles.toggleButton}
            onClick={onToggle}
            aria-label={isOpen ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            {isOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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

        {/* Conversation History */}
        {hasConversations && (
          <div className={styles.conversationsSection}>
            {isOpen && <div className={styles.sectionDivider} />}
            
            <ConversationGroup
              title="Today"
              conversations={conversations.today}
              isOpen={isOpen}
              onConversationClick={onConversationClick}
              activeUuid={activeConversationUuid}
            />
            <ConversationGroup
              title="Yesterday"
              conversations={conversations.yesterday}
              isOpen={isOpen}
              onConversationClick={onConversationClick}
              activeUuid={activeConversationUuid}
            />
            <ConversationGroup
              title="Previous 7 Days"
              conversations={conversations.last7Days}
              isOpen={isOpen}
              onConversationClick={onConversationClick}
              activeUuid={activeConversationUuid}
            />
            <ConversationGroup
              title="Previous 30 Days"
              conversations={conversations.last30Days}
              isOpen={isOpen}
              onConversationClick={onConversationClick}
              activeUuid={activeConversationUuid}
            />
            <ConversationGroup
              title="Older"
              conversations={conversations.older}
              isOpen={isOpen}
              onConversationClick={onConversationClick}
              activeUuid={activeConversationUuid}
            />
          </div>
        )}

        {isLoadingConversations && isOpen && (
          <div className={styles.loadingConversations}>
            Loading conversations...
          </div>
        )}
      </nav>
    </aside>
  );
}
