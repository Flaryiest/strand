import { useState } from 'react';
import styles from './narrativeStream.module.css';

export interface ToolDetailedResult {
  type: 'place' | 'url' | 'reddit' | 'insight';
  name?: string;
  url?: string;
  rating?: number;
  snippet?: string;
  subreddit?: string;
  quote?: string;
  author?: string;
  address?: string;
  title?: string;
  score?: number;
}

interface ToolIndicatorProps {
  toolName: string;
  status: 'running' | 'complete' | 'error';
  message?: string;
  resultSummary?: string;
  detailedResults?: ToolDetailedResult[];
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
  const [isExpanded, setIsExpanded] = useState(false);
  const label = toolLabels[toolName] || toolName;
  const hasDetails = detailedResults && detailedResults.length > 0;

  return (
    <div
      className={`${styles.toolIndicator} ${status === 'running' ? styles.toolRunning : ''} ${status === 'error' ? styles.toolError : ''} ${isExpanded ? styles.toolExpanded : ''}`}
    >
      <div 
        className={styles.toolHeader}
        onClick={() => hasDetails && status === 'complete' && setIsExpanded(!isExpanded)}
        style={{ cursor: hasDetails && status === 'complete' ? 'pointer' : 'default' }}
      >
        <span className={styles.toolLabel}>{label}</span>
        <div className={styles.toolHeaderRight}>
          {status === 'running' && (
            <span className={styles.toolSpinner}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4m0 12v4m-10-10h4m12 0h4" />
              </svg>
            </span>
          )}
          {status === 'complete' && (
            <>
              <span className={styles.toolCheck}>✓</span>
              {hasDetails && (
                <span className={styles.toolExpandIcon}>
                  {isExpanded ? '−' : '+'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      
      {message && (
        <div className={styles.toolMessage}>{message}</div>
      )}
      
      {resultSummary && status === 'complete' && !isExpanded && (
        <div className={styles.toolResult}>
          {resultSummary}
          {hasDetails && <span className={styles.toolExpandHint}> · Click to expand</span>}
        </div>
      )}
      
      {/* Expandable details section */}
      {isExpanded && status === 'complete' && hasDetails && (
        <div className={styles.toolDetails}>
          {detailedResults!.map((result, idx) => (
            <div key={idx} className={styles.toolDetailItem}>
              {result.type === 'place' && (
                <div className={styles.detailPlace}>
                  <div className={styles.detailPlaceHeader}>
                    <span className={styles.detailName}>{result.name}</span>
                    {result.rating && <span className={styles.detailRating}>{result.rating}★</span>}
                  </div>
                  {result.address && <span className={styles.detailAddress}>{result.address}</span>}
                </div>
              )}
              {result.type === 'url' && (
                <div className={styles.detailUrl}>
                  <a 
                    href={result.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.detailLink}
                  >
                    {result.url}
                  </a>
                  {result.title && <span className={styles.detailTitle}>{result.title}</span>}
                  {result.snippet && <p className={styles.detailSnippet}>{result.snippet}</p>}
                </div>
              )}
              {result.type === 'reddit' && (
                <div className={styles.detailReddit}>
                  <div className={styles.detailRedditHeader}>
                    {result.subreddit && (
                      <span className={styles.detailSubreddit}>r/{result.subreddit}</span>
                    )}
                    {result.title && (
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.detailThreadTitle}
                      >
                        {result.title}
                      </a>
                    )}
                  </div>
                  {result.quote && (
                    <blockquote className={styles.detailQuote}>
                      "{result.quote}"
                      <div className={styles.detailQuoteMeta}>
                        {result.author && <cite>u/{result.author}</cite>}
                        {result.score !== undefined && <span className={styles.detailScore}>{result.score} pts</span>}
                      </div>
                    </blockquote>
                  )}
                </div>
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
