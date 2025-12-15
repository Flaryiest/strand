import { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { StreamEvent } from '@/stores/chat';
import ToolIndicator, { ToolDetailedResult } from './ToolIndicator';
import styles from './narrativeStream.module.css';

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
  detailedResults?: ToolDetailedResult[];
}

// Typewriter text component
function TypewriterText({ 
  text, 
  isLast, 
  isStreaming,
  onComplete 
}: { 
  text: string; 
  isLast: boolean;
  isStreaming: boolean;
  onComplete?: () => void;
}) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const textRef = useRef(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track if we've caught up to current text
  const isCaughtUp = displayedLength >= text.length;

  useEffect(() => {
    // When text changes, update our ref but keep displayed position
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    // Don't run if we've caught up
    if (displayedLength >= textRef.current.length) {
      onComplete?.();
      return;
    }

    intervalRef.current = setInterval(() => {
      setDisplayedLength(prev => {
        const targetLength = textRef.current.length;
        const nextLength = Math.min(prev + 2, targetLength); // 2 chars at a time
        if (nextLength >= targetLength) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onComplete?.();
        }
        return nextLength;
      });
    }, 12); // Fast typing speed

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, displayedLength, onComplete]);

  const displayedText = text.slice(0, displayedLength);
  
  // Show cursor only on the last segment while streaming and not caught up
  const showCursor = isLast && isStreaming && !isCaughtUp;
  
  // For inline cursor: append a special marker that we'll replace with the cursor
  // This ensures cursor appears at the end of text, not on a new line
  const CURSOR_MARKER = '█CURSOR█';
  const textWithCursor = showCursor ? displayedText + CURSOR_MARKER : displayedText;

  return (
    <div className={styles.narrativeText}>
      <ReactMarkdown
        components={{
          h2: ({ children }) => <h2 className={styles.mdH2}>{children}</h2>,
          h3: ({ children }) => <h3 className={styles.mdH3}>{children}</h3>,
          p: ({ children }) => {
            // Check if children contains cursor marker and render cursor inline
            const processChildren = (child: React.ReactNode): React.ReactNode => {
              if (typeof child === 'string' && child.includes(CURSOR_MARKER)) {
                const parts = child.split(CURSOR_MARKER);
                return <>{parts[0]}<span className={styles.cursor} /></>;
              }
              return child;
            };
            const processed = Array.isArray(children) 
              ? children.map(processChildren)
              : processChildren(children);
            return <p className={styles.mdP}>{processed}</p>;
          },
          strong: ({ children }) => <strong className={styles.mdStrong}>{children}</strong>,
          ul: ({ children }) => <ul className={styles.mdUl}>{children}</ul>,
          li: ({ children }) => <li className={styles.mdLi}>{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>
              {children}
            </a>
          ),
          // Handle text nodes directly for cursor injection
          text: ({ children }) => {
            if (typeof children === 'string' && children.includes(CURSOR_MARKER)) {
              const parts = children.split(CURSOR_MARKER);
              return <>{parts[0]}<span className={styles.cursor} /></>;
            }
            return <>{children}</>;
          },
        }}
      >
        {textWithCursor}
      </ReactMarkdown>
    </div>
  );
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
          const actionName2 = event.data.action;
          let targetTool: ParsedSegment | undefined;
          
          if (actionName2) {
            // Use the action field to find the correct tool
            targetTool = toolStates.get(actionName2);
          } else {
            // Fallback: Mark the most recent running tool as complete
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

  // Find the index of the last text segment for cursor placement
  const lastTextIndex = segments.reduce((last, seg, idx) => 
    seg.type === 'text' ? idx : last, -1);

  return (
    <div className={styles.narrativeContainer}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          const isLastText = index === lastTextIndex;
          return (
            <TypewriterText
              key={index}
              text={segment.content || ''}
              isLast={isLastText}
              isStreaming={isStreaming}
            />
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

      {/* Show thinking cursor when streaming but no text segments yet, or between tool and next text */}
      {isStreaming && segments.length === 0 && (
        <div className={styles.thinkingCursor}>
          <span className={styles.cursor} />
        </div>
      )}
    </div>
  );
}

/**
 * Extract detailed results for display in tool indicator
 */
function extractDetailedResults(results: any, toolName?: string): ToolDetailedResult[] {
  if (!results) return [];
  
  const detailed: ToolDetailedResult[] = [];
  const summary = results.summary;
  
  // Handle places agent results
  if (toolName === 'places_agent' && summary?.topPlaces) {
    for (const place of summary.topPlaces.slice(0, 6)) {
      if (place?.name) {
        detailed.push({
          type: 'place',
          name: place.name,
          rating: place.rating,
          address: place.address
        });
      }
    }
  }
  
  // Handle web agent results
  if (toolName === 'web_agent' && summary) {
    // Include full URLs
    if (summary.sampleUrls) {
      for (let i = 0; i < Math.min(summary.sampleUrls.length, 5); i++) {
        const url = summary.sampleUrls[i];
        if (url) {
          detailed.push({
            type: 'url',
            url: url,
            title: summary.sources?.[i]
          });
        }
      }
    }
  }
  
  // Handle reddit agent results
  if (toolName === 'reddit_agent' && summary) {
    // Show subreddits with thread info
    if (summary.subreddits?.length > 0) {
      for (const sub of summary.subreddits.slice(0, 4)) {
        detailed.push({
          type: 'reddit',
          subreddit: sub
        });
      }
    }
    // Show sample comments with more context
    if (summary.sampleComments?.length > 0) {
      for (const comment of summary.sampleComments.slice(0, 4)) {
        if (comment?.body) {
          detailed.push({
            type: 'reddit',
            quote: comment.body.slice(0, 200) + (comment.body.length > 200 ? '...' : ''),
            author: comment.author,
            score: comment.score
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
