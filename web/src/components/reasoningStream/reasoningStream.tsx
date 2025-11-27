import { StreamEvent } from '@/stores/chat';
import styles from './reasoningStream.module.css';

interface ReasoningStreamProps {
  events: StreamEvent[];
  accumulatedResponse?: string;
}

export default function ReasoningStream({
  events,
  accumulatedResponse
}: ReasoningStreamProps) {
  const renderEvent = (event: StreamEvent, index: number) => {
    const baseDelay = index * 0.05; // Stagger animation

    switch (event.type) {
      case 'thinking':
        return (
          <div
            key={`${event.step}-${index}`}
            className={styles.eventCard}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <path d="M9 21h6" />
                <path d="M9 18h6" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Thinking</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      case 'action':
        return (
          <div
            key={`${event.step}-${index}`}
            className={styles.eventCard}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Action</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
              {event.data.action && (
                <div className={styles.eventDetail}>
                  <code>{event.data.action}</code>
                </div>
              )}
            </div>
          </div>
        );

      case 'data':
        return (
          <div
            key={`${event.step}-${index}`}
            className={styles.eventCard}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Data Received</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      case 'analyzing':
        return (
          <div
            key={`${event.step}-${index}`}
            className={styles.eventCard}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Analyzing</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      case 'deciding':
        return (
          <div
            key={`${event.step}-${index}`}
            className={styles.eventCard}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Deciding</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      case 'result':
        return (
          <div
            key={`${event.step}-${index}`}
            className={`${styles.eventCard} ${styles.resultCard}`}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Result</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div
            key={`${event.step}-${index}`}
            className={`${styles.eventCard} ${styles.errorCard}`}
            style={{ animationDelay: `${baseDelay}s` }}
          >
            <div className={styles.eventIcon}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className={styles.eventContent}>
              <div className={styles.eventType}>Error</div>
              <div className={styles.eventMessage}>{event.data.message}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.streamContainer}>
      {events.map((event, index) => renderEvent(event, index))}

      {accumulatedResponse && (
        <div className={styles.responseCard}>
          <div className={styles.responseHeader}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Assistant</span>
          </div>
          <div className={styles.responseContent}>{accumulatedResponse}</div>
        </div>
      )}
    </div>
  );
}
