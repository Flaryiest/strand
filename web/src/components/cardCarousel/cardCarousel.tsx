import { useState, useCallback, useRef } from 'react';
import {
  RecommendationSlot,
  PlaceRecommendation
} from '@/types/recommendation.types';
import LocationCard from '@/components/locationCard/locationCard';
import styles from './cardCarousel.module.css';

interface CardCarouselProps {
  slot: RecommendationSlot;
  slotNumber: number;
  onSelectionChange?: (slotId: string, selectedIndex: number) => void;
  onViewOnMap?: (place: PlaceRecommendation) => void;
}

export default function CardCarousel({
  slot,
  slotNumber,
  onSelectionChange,
  onViewOnMap
}: CardCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(slot.selectedIndex || 0);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50; // Minimum swipe distance in pixels

  // Combine primary with alternatives for navigation
  const allOptions = [slot.primary, ...slot.alternatives];
  const hasMultiple = allOptions.length > 1;

  const goToNext = useCallback(() => {
    const nextIndex = (selectedIndex + 1) % allOptions.length;
    setSelectedIndex(nextIndex);
    onSelectionChange?.(slot.slotId, nextIndex);
  }, [selectedIndex, allOptions.length, slot.slotId, onSelectionChange]);

  const goToPrev = useCallback(() => {
    const prevIndex =
      selectedIndex === 0 ? allOptions.length - 1 : selectedIndex - 1;
    setSelectedIndex(prevIndex);
    onSelectionChange?.(slot.slotId, prevIndex);
  }, [selectedIndex, allOptions.length, slot.slotId, onSelectionChange]);

  const goToIndex = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      onSelectionChange?.(slot.slotId, index);
    },
    [slot.slotId, onSelectionChange]
  );

  // Touch event handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && hasMultiple) {
      goToNext();
    } else if (isRightSwipe && hasMultiple) {
      goToPrev();
    }

    // Reset
    touchStartX.current = null;
    touchEndX.current = null;
  }, [hasMultiple, goToNext, goToPrev]);

  const getChoiceLabel = (index: number) => {
    if (index === 0) return 'Top Pick';
    if (index === 1) return '2nd Choice';
    if (index === 2) return '3rd Choice';
    return `Option ${index + 1}`;
  };

  return (
    <div className={styles.container}>
      {/* Header with slot info and navigation */}
      <div className={styles.header}>
        <div className={styles.slotInfo}>
          <span className={styles.slotNumber}>{slotNumber}</span>
          <span className={styles.slotLabel}>
            {slot.slotIcon && <span>{slot.slotIcon} </span>}
            {slot.slotLabel}
          </span>
          {slot.timeEstimate && (
            <span className={styles.timeEstimate}>
              <svg
                className={styles.timeIcon}
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
              {slot.timeEstimate}
            </span>
          )}
        </div>

        {hasMultiple && (
          <div className={styles.navigation}>
            <button
              className={styles.navButton}
              onClick={goToPrev}
              aria-label="Previous option"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.counter}>
              {selectedIndex + 1} / {allOptions.length}
            </span>
            <button
              className={styles.navButton}
              onClick={goToNext}
              aria-label="Next option"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Current Card Display */}
      <div
        className={styles.cardsWrapper}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.cardsTrack}
          style={{ transform: `translateX(-${selectedIndex * 100}%)` }}
        >
          {allOptions.map((place, idx) => (
            <div key={place.id} className={styles.cardSlide}>
              <LocationCard
                place={place}
                selected={idx === selectedIndex}
                onViewOnMap={onViewOnMap ? () => onViewOnMap(place) : undefined}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots Indicator */}
      {hasMultiple && (
        <div className={styles.dots}>
          {allOptions.map((_, idx) => (
            <button
              key={idx}
              className={`${styles.dot} ${idx === selectedIndex ? styles.dotActive : ''}`}
              onClick={() => goToIndex(idx)}
              aria-label={`Go to option ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Alternative Thumbnails */}
      {hasMultiple && allOptions.length <= 4 && (
        <div className={styles.alternativesPreview}>
          {allOptions.map((place, idx) => (
            <button
              key={place.id}
              className={`${styles.alternativeThumb} ${idx === selectedIndex ? styles.alternativeThumbActive : ''}`}
              onClick={() => goToIndex(idx)}
            >
              {place.photoUrl ? (
                <img
                  src={place.photoUrl}
                  alt=""
                  className={styles.thumbImage}
                />
              ) : (
                <div className={styles.thumbImagePlaceholder}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                    <path d="M7 2v20" />
                    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3" />
                    <path d="M21 7h-8" />
                  </svg>
                </div>
              )}
              <div className={styles.thumbInfo}>
                <div className={styles.thumbName}>{place.name}</div>
                {place.rating && (
                  <div className={styles.thumbRating}>
                    <svg
                      className={styles.thumbRatingIcon}
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {place.rating.toFixed(1)}
                  </div>
                )}
              </div>
              <span
                className={`${styles.choiceLabel} ${idx === 0 ? styles.choiceLabelPrimary : ''}`}
              >
                {getChoiceLabel(idx)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Mobile Swipe Hint */}
      {hasMultiple && (
        <div className={styles.swipeHint}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          Swipe to see {allOptions.length - 1} more option
          {allOptions.length > 2 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
