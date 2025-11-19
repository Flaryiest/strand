import { create } from 'zustand';
import { baseUrl } from '@/utils/baseUrl';

interface LocationState {
  location: string | null;
  coordinates: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
}

interface LocationActions {
  setLocation: (
    location: string,
    coordinates?: { lat: number; lng: number }
  ) => void;
  updateLocationInBackend: () => Promise<void>;
  detectLocation: () => Promise<void>;
  clearError: () => void;
}

type LocationStore = LocationState & LocationActions;

// Load initial location from localStorage
const loadLocationFromStorage = (): Partial<LocationState> => {
  try {
    const savedLocation = localStorage.getItem('userLocation');
    const savedCoordinates = localStorage.getItem('userCoordinates');

    if (savedLocation) {
      return {
        location: savedLocation,
        coordinates: savedCoordinates ? JSON.parse(savedCoordinates) : null
      };
    }
  } catch (error) {
    console.error('Error loading location from storage:', error);
  }
  return {};
};

export const useLocationStore = create<LocationStore>((set, get) => ({
  // Initial state
  location: null,
  coordinates: null,
  isLoading: false,
  error: null,
  ...loadLocationFromStorage(),

  // Actions
  setLocation: (
    location: string,
    coordinates?: { lat: number; lng: number }
  ) => {
    // Save to localStorage
    localStorage.setItem('userLocation', location);
    if (coordinates) {
      localStorage.setItem('userCoordinates', JSON.stringify(coordinates));
    }

    set({
      location,
      coordinates: coordinates || null,
      error: null
    });

    // Update backend after setting local state
    get().updateLocationInBackend();
  },

  updateLocationInBackend: async () => {
    const { location } = get();
    if (!location) return;

    try {
      const response = await fetch(`${baseUrl}/auth/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ location })
      });

      if (!response.ok) {
        console.error('Failed to update location in backend');
      }
    } catch (error) {
      console.error('Error updating location in backend:', error);
    }
  },

  detectLocation: async () => {
    set({ isLoading: true, error: null });

    if (!navigator.geolocation) {
      set({
        error: 'Geolocation is not supported by your browser',
        isLoading: false
      });
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: true
          });
        }
      );

      const { latitude, longitude } = position.coords;
      const coordinates = { lat: latitude, lng: longitude };

      // Reverse geocode to get location name via backend API
      const geocodeResponse = await fetch(
        `${baseUrl}/maps/geocode?lat=${latitude}&lng=${longitude}`,
        {
          credentials: 'include'
        }
      );

      if (!geocodeResponse.ok) {
        throw new Error('Failed to reverse geocode location');
      }

      const geocodeData = await geocodeResponse.json();

      if (geocodeData.fullAddress) {
        // Use full exact address instead of just city/state
        get().setLocation(geocodeData.fullAddress, coordinates);
        set({ isLoading: false });
      } else if (geocodeData.location) {
        // Fallback to city/state if full address not available
        get().setLocation(geocodeData.location, coordinates);
        set({ isLoading: false });
      } else {
        set({
          error: 'Could not determine location name',
          isLoading: false
        });
      }
    } catch (error: any) {
      console.error('Geolocation error:', error);
      let errorMessage = 'Failed to detect location';

      if (error.code === 1) {
        errorMessage =
          'Location access denied. Please enable location permissions.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please try again.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }

      set({ error: errorMessage, isLoading: false });
    }
  },

  clearError: () => set({ error: null })
}));
