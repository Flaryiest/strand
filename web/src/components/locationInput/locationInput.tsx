import { useState, useEffect, useRef } from 'react';
import { useLocationStore } from '@/stores/location';
import { baseUrl } from '@/utils/baseUrl';
import styles from './locationInput.module.css';

interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export default function LocationInput() {
  const { location, isLoading, error, setLocation, detectLocation, clearError } = useLocationStore();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync input value with store location
  useEffect(() => {
    if (location && !inputValue) {
      setInputValue(location);
    }
  }, [location]);

  // Handle clicks outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        `${baseUrl}/maps/autocomplete?input=${encodeURIComponent(input)}`,
        {
          credentials: 'include'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(true);
    clearError();
    fetchSuggestions(value);
  };

  const handleSuggestionClick = async (suggestion: PlaceSuggestion) => {
    setInputValue(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);

    // Get place details to extract coordinates via backend
    try {
      const response = await fetch(
        `${baseUrl}/maps/place-details?placeId=${encodeURIComponent(suggestion.placeId)}`,
        {
          credentials: 'include'
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.coordinates) {
          setLocation(suggestion.description, data.coordinates);
        } else {
          setLocation(suggestion.description);
        }
      } else {
        // If we can't get coordinates, just save the location name
        setLocation(suggestion.description);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      setLocation(suggestion.description);
    }
  };

  const handleDetectLocation = () => {
    detectLocation();
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className={styles.locationContainer}>
      <div className={styles.locationInputWrapper}>
        <svg
          className={styles.locationIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        
        <input
          ref={inputRef}
          type="text"
          className={styles.locationInput}
          placeholder="Enter your location..."
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={isLoading}
        />

        <button
          className={styles.detectButton}
          onClick={handleDetectLocation}
          disabled={isLoading}
          title="Detect my location"
        >
          {isLoading ? (
            <div className={styles.spinner} />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className={styles.suggestionsDropdown}>
          {isLoadingSuggestions && (
            <div className={styles.suggestionItem}>
              <div className={styles.spinner} />
              <span>Loading suggestions...</span>
            </div>
          )}
          {!isLoadingSuggestions && suggestions.map((suggestion) => (
            <div
              key={suggestion.placeId}
              className={styles.suggestionItem}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <svg
                className={styles.suggestionIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{suggestion.description}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
