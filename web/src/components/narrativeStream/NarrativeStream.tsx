import { useMemo } from 'react';
import { StreamEvent } from '@/stores/chat';
import ToolIndicator from './ToolIndicator';
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
              currentText += ' ';
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
          // Find the corresponding tool and mark it complete
          // Extract tool name from message (e.g., "Received data from X")
          const dataMsg = event.data.message || '';
          const toolMatch = dataMsg.match(/from (\w+)/);
          if (toolMatch) {
            const foundTool = toolStates.get(toolMatch[1]);
            if (foundTool) {
              foundTool.toolStatus = 'complete';
              foundTool.toolResult = summarizeResults(event.data.results);
            }
          } else {
            // Mark the most recent running tool as complete
            for (const [, tool] of toolStates) {
              if (tool.toolStatus === 'running') {
                tool.toolStatus = 'complete';
                tool.toolResult = summarizeResults(event.data.results);
                break;
              }
            }
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
            if (currentText) currentText += ' ';
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
            <p key={index} className={styles.narrativeText}>
              {segment.content}
              {isStreaming && index === segments.length - 1 && (
                <span className={styles.cursor}>|</span>
              )}
            </p>
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
            />
          );
        }

        return null;
      })}

      {/* Show cursor at end if streaming with no text yet */}
      {isStreaming && segments.length === 0 && (
        <p className={styles.narrativeText}>
          <span className={styles.cursor}>|</span>
        </p>
      )}
    </div>
  );
}

/**
 * Summarize tool results into a brief string
 */
function summarizeResults(results: any): string {
  if (!results) return '';

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
