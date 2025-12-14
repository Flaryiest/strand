import styles from './narrativeStream.module.css';

interface ToolIndicatorProps {
  toolName: string;
  status: 'running' | 'complete' | 'error';
  message?: string;
  resultSummary?: string;
}

const toolIcons: Record<string, string> = {
  SearchPlacesTool: '📍',
  RedditSearchTool: '💬',
  WebSearchTool: '🔍',
  places_agent: '📍',
  reddit_agent: '💬',
  web_agent: '🌐',
  default: '⚡'
};

const toolLabels: Record<string, string> = {
  SearchPlacesTool: 'Google Maps',
  RedditSearchTool: 'Reddit',
  WebSearchTool: 'Web Search',
  places_agent: 'Places Search',
  reddit_agent: 'Reddit Search',
  web_agent: 'Web Search',
  default: 'Processing'
};

export default function ToolIndicator({
  toolName,
  status,
  message,
  resultSummary
}: ToolIndicatorProps) {
  const icon = toolIcons[toolName] || toolIcons.default;
  const label = toolLabels[toolName] || toolName;

  return (
    <div
      className={`${styles.toolIndicator} ${status === 'running' ? styles.toolRunning : ''} ${status === 'error' ? styles.toolError : ''}`}
    >
      <div className={styles.toolHeader}>
        <span className={styles.toolIcon}>{icon}</span>
        <span className={styles.toolLabel}>{label}</span>
        {status === 'running' && (
          <span className={styles.toolSpinner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4m-10-10h4m12 0h4m-2.93-7.07l-2.83 2.83m-8.48 8.48l-2.83 2.83m0-14.14l2.83 2.83m8.48 8.48l2.83 2.83" />
            </svg>
          </span>
        )}
        {status === 'complete' && (
          <span className={styles.toolCheck}>✓</span>
        )}
      </div>
      {message && (
        <div className={styles.toolMessage}>{message}</div>
      )}
      {resultSummary && status === 'complete' && (
        <div className={styles.toolResult}>{resultSummary}</div>
      )}
    </div>
  );
}
