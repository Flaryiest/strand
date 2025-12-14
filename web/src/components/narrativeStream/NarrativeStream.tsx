import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { StreamEvent } from '@/stores/chat';
import ToolIndicator from './ToolIndicator';
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

interface NarrativeStreamProps {
  events: StreamEvent[];
  isStreaming?: boolean;
}

interface ParsedSegment {
  type: 'text' | 'tool';
  content?: string;
  toolName?: string;
  toolStatus?: 'running' | 'complete' | 'error';
  toolMessage?: string;
  toolResult?: string;
  detailedResults?: ToolResult[];
}

export default function NarrativeStream({
  events,
  isStreaming = false
}: NarrativeStreamProps) {
  // Parse events into renderable segments
  const segments = useMemo(() => {
    const result: ParsedSegment[] = [];
    let currentText = '';
    const toolStates = new Map<string, ParsedSegment>();

    for (const event of events) {
      switch (event.type) {
        case 'thinking':
        case 'analyzing':
        case 'deciding':
          // These become flowing narrative text
          if (event.data.message) {
            if (currentText) {
              currentText += '\n\n';
            }
            currentText += event.data.message;
          }
          break;

        case 'action':
          // Flush any accumulated text
          if (currentText.trim()) {
            result.push({ type: 'text', content: currentText.trim() });
            currentText = '';
          }
          
          // Start a tool indicator
          const actionName = event.data.action || 'unknown';
          const toolSegment: ParsedSegment = {
            type: 'tool',
            toolName: actionName,
            toolStatus: 'running',
            toolMessage: event.data.message
          };
          toolStates.set(actionName, toolSegment);
          result.push(toolSegment);
          break;

        case 'data':
          // Find the corresponding tool and mark it complete with detailed results
          const dataMsg = event.data.message || '';
          const toolMatch = dataMsg.match(/from (\w+)/);
          let targetTool: ParsedSegment | undefined;
          
          if (toolMatch) {
            targetTool = toolStates.get(toolMatch[1]);
          } else {
            // Mark the most recent running tool as complete
            for (const [, tool] of toolStates) {
              if (tool.toolStatus === 'running') {
                targetTool = tool;
                break;
              }
            }
          }
          
          if (targetTool) {
            targetTool.toolStatus = 'complete';
            targetTool.toolResult = summarizeResults(event.data.results);
            targetTool.detailedResults = extractDetailedResults(event.data.results, targetTool.toolName);
          }
          break;

        case 'token':
          // Streaming tokens - add to current text
          if (event.data.message) {
            currentText += event.data.message;
          }
          break;

        case 'result':
          // Final result text
          if (event.data.message) {
            if (currentText) currentText += '\n\n';
            currentText += event.data.message;
          }
          break;

        case 'error':
          // Show error inline
          if (currentText.trim()) {
            result.push({ type: 'text', content: currentText.trim() });
            currentText = '';
          }
          // Find running tool and mark as error
          for (const [, tool] of toolStates) {
            if (tool.toolStatus === 'running') {
              tool.toolStatus = 'error';
              tool.toolResult = event.data.message;
              break;
            }
          }
          break;
      }
    }

    // Flush remaining text
    if (currentText.trim()) {
      result.push({ type: 'text', content: currentText.trim() });
    }

    return result;
  }, [events]);

  if (segments.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <div className={styles.narrativeContainer}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <div key={index} className={styles.narrativeText}>
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className={styles.mdH2}>{children}</h2>,
                  h3: ({ children }) => <h3 className={styles.mdH3}>{children}</h3>,
                  p: ({ children }) => <p className={styles.mdP}>{children}</p>,
                  strong: ({ children }) => <strong className={styles.mdStrong}>{children}</strong>,
                  ul: ({ children }) => <ul className={styles.mdUl}>{children}</ul>,
                  li: ({ children }) => <li className={styles.mdLi}>{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>
                      {children}
                    </a>
                  ),
                }}
              >
                {segment.content || ''}
              </ReactMarkdown>
              {isStreaming && index === segments.length - 1 && (
                <span className={styles.cursor}>|</span>
              )}
            </div>
          );
        }

        if (segment.type === 'tool') {
          return (
            <ToolIndicator
              key={`tool-${index}`}
              toolName={segment.toolName || 'unknown'}
              status={segment.toolStatus || 'running'}
              message={segment.toolMessage}
              resultSummary={segment.toolResult}
              detailedResults={segment.detailedResults}
            />
          );
        }

        return null;
      })}

      {/* Show cursor at end if streaming with no text yet */}
      {isStreaming && segments.length === 0 && (
        <div className={styles.narrativeText}>
          <span className={styles.cursor}>|</span>
        </div>
      )}
    </div>
  );
}

/**
 * Extract detailed results for display in tool indicator
 */
function extractDetailedResults(results: any, toolName?: string): ToolResult[] {
  if (!results) return [];
  
  const detailed: ToolResult[] = [];
  const summary = results.summary;
  
  // Handle places agent results
  if (toolName === 'places_agent' && summary?.topPlaces) {
    for (const place of summary.topPlaces.slice(0, 4)) {
      if (place?.name) {
        detailed.push({
          type: 'place',
          name: place.name,
          rating: place.rating
        });
      }
    }
  }
  
  // Handle web agent results
  if (toolName === 'web_agent' && summary?.sampleUrls) {
    for (const url of summary.sampleUrls.slice(0, 3)) {
      if (url) {
        detailed.push({
          type: 'url',
          url: url,
          name: summary.sources?.[summary.sampleUrls.indexOf(url)]
        });
      }
    }
  }
  
  // Handle reddit agent results
  if (toolName === 'reddit_agent' && summary) {
    // Show subreddits searched
    if (summary.subreddits?.length > 0) {
      for (const sub of summary.subreddits.slice(0, 3)) {
        detailed.push({
          type: 'reddit',
          subreddit: sub
        });
      }
    }
    // Show sample comments
    if (summary.sampleComments?.length > 0) {
      for (const comment of summary.sampleComments.slice(0, 2)) {
        if (comment?.body) {
          detailed.push({
            type: 'reddit',
            quote: comment.body.slice(0, 150) + (comment.body.length > 150 ? '...' : ''),
            author: comment.author
          });
        }
      }
    }
  }
  
  return detailed;
}

/**
 * Summarize tool results into a brief string
 */
function summarizeResults(results: any): string {
  if (!results) return '';
  
  const count = results.count;
  const summary = results.summary;

  // Handle places agent
  if (summary?.topPlaces) {
    const topPlace = summary.topPlaces[0];
    if (topPlace?.name) {
      return `Found ${count} places including ${topPlace.name}`;
    }
    return `Found ${count} places`;
  }
  
  // Handle web agent
  if (summary?.sources) {
    return `Found ${count} articles from ${summary.sources.slice(0, 2).join(', ')}${summary.sources.length > 2 ? '...' : ''}`;
  }
  
  // Handle reddit agent
  if (summary?.subreddits) {
    return `Found ${summary.threadsFetched || count} discussions in ${summary.subreddits.slice(0, 2).map((s: string) => 'r/' + s).join(', ')}`;
  }

  // Handle array of places
  if (Array.isArray(results)) {
    if (results.length === 0) return 'No results found';
    
    // Check if it's places data
    if (results[0]?.name) {
      return `Found ${results.length} places`;
    }
    
    // Check if it's search results
    if (results[0]?.title || results[0]?.url) {
      return `Found ${results.length} results`;
    }
    
    return `${results.length} items`;
  }

  // Handle object with results array
  if (results.results && Array.isArray(results.results)) {
    return `Found ${results.results.length} results`;
  }

  // Handle places object
  if (results.places && Array.isArray(results.places)) {
    return `Found ${results.places.length} places`;
  }

  // Handle threads (Reddit)
  if (results.threads && Array.isArray(results.threads)) {
    return `Found ${results.threads.length} discussions`;
  }

  // Handle error
  if (results.error) {
    return `Error: ${results.error}`;
  }

  return 'Complete';
}
