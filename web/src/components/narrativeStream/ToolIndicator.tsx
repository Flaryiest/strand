import styles from './narrativeStream.module.css';

interface ToolResult {
  type: 'place' | 'url' | 'reddit' | 'insight';
  name?: string;
  url?: string;
  rating?: number;
  snippet?: string;
  subreddit?: string;
  quote?: string;
  author?: string;
}

interface ToolIndicatorProps {
  toolName: string;
  status: 'running' | 'complete' | 'error';
  message?: string;
  resultSummary?: string;
  detailedResults?: ToolResult[];
}

const toolLabels: Record<string, string> = {
  SearchPlacesTool: 'Google Maps',
  RedditSearchTool: 'Reddit',
  WebSearchTool: 'Web Search',
  places_agent: 'Places',
  reddit_agent: 'Reddit',
  web_agent: 'Web',
  default: 'Processing'
};

export default function ToolIndicator({
  toolName,
  status,
  message,
  resultSummary,
  detailedResults
}: ToolIndicatorProps) {
  const label = toolLabels[toolName] || toolName;

  return (
    <div
      className={`${styles.toolIndicator} ${status === 'running' ? styles.toolRunning : ''} ${status === 'error' ? styles.toolError : ''}`}
    >
      <div className={styles.toolHeader}>
        <span className={styles.toolLabel}>{label}</span>
        {status === 'running' && (
          <span className={styles.toolSpinner}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4m0 12v4m-10-10h4m12 0h4" />
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
      
      {/* Detailed results - places, URLs, Reddit comments */}
      {detailedResults && detailedResults.length > 0 && status === 'complete' && (
        <div className={styles.toolDetails}>
          {detailedResults.map((result, idx) => (
            <div key={idx} className={styles.toolDetailItem}>
              {result.type === 'place' && (
                <>
                  <span className={styles.detailName}>{result.name}</span>
                  {result.rating && <span className={styles.detailMeta}>{result.rating}★</span>}
                </>
              )}
              {result.type === 'url' && (
                <>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>
                    {result.name || new URL(result.url || '').hostname}
                  </a>
                  {result.snippet && <span className={styles.detailSnippet}>{result.snippet}</span>}
                </>
              )}
              {result.type === 'reddit' && (
                <>
                  <span className={styles.detailSubreddit}>r/{result.subreddit}</span>
                  {result.quote && (
                    <blockquote className={styles.detailQuote}>
                      "{result.quote}"
                      {result.author && <cite>— u/{result.author}</cite>}
                    </blockquote>
                  )}
                </>
              )}
              {result.type === 'insight' && (
                <span className={styles.detailInsight}>{result.snippet}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
