import { BaseTool } from './BaseTool.js';
import { config } from '../../config.js';

interface PlaceSearchParams {
  query: string;
  location?: string;
  radius?: number;
  type?: string;
}

interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  types: string[];
  location: {
    lat: number;
    lng: number;
  };
  placeId: string;
}

export class SearchPlacesTool extends BaseTool {
  name = 'search_places';
  description = 'Search for places, restaurants, attractions, hotels, and other locations using Google Places API. Returns detailed information including name, address, rating, and location coordinates.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query (e.g., "restaurants in Paris", "hotels near Eiffel Tower")'
      },
      location: {
        type: 'string',
        description: 'Optional location context (e.g., "Paris, France", "New York, NY")'
      },
      radius: {
        type: 'number',
        description: 'Search radius in meters (default: 5000)'
      },
      type: {
        type: 'string',
        description: 'Place type filter (e.g., "restaurant", "hotel", "tourist_attraction")'
      }
    },
    required: ['query']
  };

  async execute(params: PlaceSearchParams): Promise<any> {
    this.validateParams(params);

    if (!config.googleMapsApiKey) {
      throw new Error('Google Maps API key is not configured');
    }

    try {
      // Build the search query
      let searchQuery = params.query;
      if (params.location) {
        searchQuery = `${params.query} in ${params.location}`;
      }

      // Use Google Places Text Search API
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.append('query', searchQuery);
      url.searchParams.append('key', config.googleMapsApiKey);
      
      if (params.type) {
        url.searchParams.append('type', params.type);
      }

      if (params.radius) {
        url.searchParams.append('radius', params.radius.toString());
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API returned status: ${data.status}`);
      }

      // Transform results into a cleaner format
      const places: PlaceResult[] = (data.results || []).map((place: any) => ({
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        priceLevel: place.price_level,
        types: place.types || [],
        location: {
          lat: place.geometry?.location?.lat,
          lng: place.geometry?.location?.lng
        },
        placeId: place.place_id
      }));

      return {
        success: true,
        query: searchQuery,
        count: places.length,
        places: places.slice(0, 10), // Return top 10 results
        metadata: {
          apiStatus: data.status,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('SearchPlacesTool error:', error);
      throw error;
    }
  }
}
