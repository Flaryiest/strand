import { PlaceRecommendation } from '@/types/recommendation.types';
import styles from './locationCard.module.css';

interface LocationCardProps {
  place: PlaceRecommendation;
  slotLabel?: string;
  slotIcon?: string;
  variant?: 'default' | 'compact';
  selected?: boolean;
  animationDelay?: number;
  onSelect?: () => void;
  onViewOnMap?: () => void;
}

export default function LocationCard({
  place,
  slotLabel,
  slotIcon,
  variant = 'default',
  selected = false,
  animationDelay = 0,
  onSelect,
  onViewOnMap
}: LocationCardProps) {
  const formatPriceLevel = (level?: number) => {
    if (!level) return null;
    return '$'.repeat(level);
  };

  const formatReviewCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000) {
      return `(${(count / 1000).toFixed(1)}k)`;
    }
    return `(${count})`;
  };

  const formatTypes = (types: string[]) => {
    return types
      .slice(0, 3)
      .map(t => t.replace(/_/g, ' '))
      .filter(t => !['point_of_interest', 'establishment'].includes(t));
  };

  return (
    <article
      className={`${styles.card} ${variant === 'compact' ? styles.compact : ''} ${selected ? styles.selected : ''}`}
      style={{ animationDelay: `${animationDelay}s` }}
      onClick={onSelect}
    >
      {/* Image Section */}
      <div className={styles.imageContainer}>
        {place.photoUrl ? (
          <img
            src={place.photoUrl}
            alt={place.name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Slot Badge */}
        {slotLabel && (
          <div className={styles.slotBadge}>
            {slotIcon && <span className={styles.slotIcon}>{slotIcon}</span>}
            {slotLabel}
          </div>
        )}

        {/* Price Badge */}
        {place.priceLevel && (
          <div className={styles.priceBadge}>
            {formatPriceLevel(place.priceLevel)}
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className={styles.content}>
        {/* Header with name and rating */}
        <div className={styles.header}>
          <h3 className={styles.name}>{place.name}</h3>
          {place.rating && (
            <div className={styles.rating}>
              <svg className={styles.ratingIcon} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className={styles.ratingValue}>{place.rating.toFixed(1)}</span>
              {place.reviewCount && (
                <span className={styles.reviewCount}>{formatReviewCount(place.reviewCount)}</span>
              )}
            </div>
          )}
        </div>

        {/* Address */}
        <div className={styles.address}>
          <svg className={styles.addressIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{place.address}</span>
        </div>

        {/* AI Recommendation Reason */}
        {place.reason && variant !== 'compact' && (
          <div className={styles.reason}>
            <span className={styles.reasonText}>{place.reason}</span>
          </div>
        )}

        {/* Highlights */}
        {place.highlights && place.highlights.length > 0 && variant !== 'compact' && (
          <div className={styles.highlights}>
            {place.highlights.map((highlight, idx) => (
              <span key={idx} className={styles.highlightTag}>
                {highlight}
              </span>
            ))}
          </div>
        )}

        {/* Best For */}
        {place.bestFor && variant !== 'compact' && (
          <div className={styles.bestFor}>
            <svg className={styles.bestForIcon} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{place.bestFor}</span>
          </div>
        )}

        {/* Type Tags */}
        {place.types && place.types.length > 0 && (
          <div className={styles.types}>
            {formatTypes(place.types).map((type, idx) => (
              <span key={idx} className={styles.typeTag}>
                {type}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        {variant !== 'compact' && (
          <div className={styles.actions}>
            {place.googleMapsUrl && (
              <a
                href={place.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionButton} ${styles.secondaryAction}`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open in Maps
              </a>
            )}
            {onViewOnMap && (
              <button
                className={`${styles.actionButton} ${styles.primaryAction}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOnMap();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                View on Map
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

