import { useState, useCallback } from 'react';
import {
  ItineraryRecommendation,
  PlaceRecommendation
} from '@/types/recommendation.types';
import CardCarousel from '@/components/cardCarousel/cardCarousel';
import styles from './itineraryView.module.css';

interface ItineraryViewProps {
  itinerary: ItineraryRecommendation;
  onViewFullMap?: () => void;
  onRefine?: () => void;
}

export default function ItineraryView({
  itinerary,
  onViewFullMap,
  onRefine
}: ItineraryViewProps) {
  const [selections, setSelections] = useState<Record<string, number>>(() => {
    // Initialize with default selections
    const initial: Record<string, number> = {};
    itinerary.slots.forEach((slot) => {
      initial[slot.slotId] = slot.selectedIndex || 0;
    });
    return initial;
  });

  const handleSelectionChange = useCallback(
    (slotId: string, selectedIndex: number) => {
      setSelections((prev) => ({
        ...prev,
        [slotId]: selectedIndex
      }));
    },
    []
  );

  const handleViewOnMap = useCallback((place: PlaceRecommendation) => {
    // For now, open Google Maps URL if available
    if (place.googleMapsUrl) {
      window.open(place.googleMapsUrl, '_blank');
    } else if (place.location) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`,
        '_blank'
      );
    }
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (!itinerary.slots || itinerary.slots.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <svg
            className={styles.emptyIcon}
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className={styles.emptyText}>
            No recommendations found. Try a different search.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h2 className={styles.title}>Your Personalized Itinerary</h2>
        <p className={styles.subtitle}>{itinerary.summary}</p>

        {/* Meta Info */}
        {(itinerary.totalEstimatedTime || itinerary.totalEstimatedCost) && (
          <div className={styles.metaBar}>
            {itinerary.totalEstimatedTime && (
              <div className={styles.metaItem}>
                <svg
                  className={styles.metaIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Duration:</span>
                <span className={styles.metaValue}>
                  {itinerary.totalEstimatedTime}
                </span>
              </div>
            )}
            {itinerary.totalEstimatedCost && (
              <div className={styles.metaItem}>
                <svg
                  className={styles.metaIcon}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Est. Cost:</span>
                <span className={styles.metaValue}>
                  {itinerary.totalEstimatedCost}
                </span>
              </div>
            )}
            <div className={styles.metaItem}>
              <svg
                className={styles.metaIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Stops:</span>
              <span className={styles.metaValue}>{itinerary.slots.length}</span>
            </div>
          </div>
        )}
      </header>

      {/* Recommendation Slots */}
      <div className={styles.slotsContainer}>
        {itinerary.slots.map((slot, index) => (
          <div key={slot.slotId}>
            <div className={styles.slotWrapper}>
              <CardCarousel
                slot={slot}
                slotNumber={index + 1}
                onSelectionChange={handleSelectionChange}
                onViewOnMap={handleViewOnMap}
              />
            </div>

            {/* Travel Info Between Stops */}
            {index < itinerary.slots.length - 1 && (
              <div className={styles.travelInfo}>
                <div className={styles.travelBadge}>
                  <svg
                    className={styles.travelIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  ~15 min drive
                </div>
                <div className={styles.travelBadge}>
                  <svg
                    className={styles.travelIcon}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <path d="M9 17h6" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                  2.3 mi
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.actionsBar}>
        <button
          className={`${styles.actionButton} ${styles.primaryButton}`}
          onClick={onViewFullMap || (() => {})}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          View Full Map
        </button>
        <button
          className={`${styles.actionButton} ${styles.secondaryButton}`}
          onClick={handleCopyLink}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Copy Link
        </button>
        <button
          className={`${styles.actionButton} ${styles.ghostButton}`}
          onClick={onRefine}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Refine Plan
        </button>
      </div>

      {/* Timestamp */}
      <p className={styles.timestamp}>
        Generated {formatTimestamp(itinerary.generatedAt)}
      </p>
    </div>
  );
}
