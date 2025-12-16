import { BaseToolAgent, AgentContext, EvaluationResult } from './BaseToolAgent.js';
import { PLACES_EVAL_PROMPT } from '../../prompts/agentPrompts.js';
import { config } from '../../config.js';

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
  userRatingsTotal?: number;
  photoUrl?: string;
}

interface PlacesSearchParams {
  query: string;
  location?: string;
  radius?: number;
  type?: string;
  excludePlaceIds?: Set<string>; // Place IDs to exclude from results
}

export class PlacesAgent extends BaseToolAgent {
  name = 'places_agent';
  description = 'Searches Google Places API for real business data including addresses, ratings, and coordinates';
  protected maxIterations = 2;

  private defaultRadius = 5000; // 5km
  
  // Store context for access in search method
  private currentContext: AgentContext | null = null;

  protected getInitialParams(context: AgentContext): Record<string, any> {
    // Store context for use in search
    this.currentContext = context;
    
    return {
      query: context.goal,
      location: context.location,
      radius: this.defaultRadius,
      excludePlaceIds: context.seenPlaceIds
    };
  }

  protected async search(params: PlacesSearchParams): Promise<PlaceResult[]> {
    if (!config.googleMapsApiKey) {
      throw new Error('Google Maps API key is not configured');
    }

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

    console.log(`[PlacesAgent] Searching: ${searchQuery}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API returned status: ${data.status}`);
    }

    const excludePlaceIds = params.excludePlaceIds || this.currentContext?.seenPlaceIds;
    
    // Normalize the user's location for comparison (to exclude it from results)
    const userLocationNormalized = params.location?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

    // Transform results, filtering out already-seen places and user's own address
    const places: PlaceResult[] = (data.results || [])
      .filter((place: any) => {
        if (excludePlaceIds && excludePlaceIds.has(place.place_id)) {
          console.log(`[PlacesAgent] Filtering out already-seen place: ${place.name}`);
          return false;
        }
        
        // Filter out user's own address
        if (userLocationNormalized && place.formatted_address) {
          const placeAddressNormalized = place.formatted_address.toLowerCase().replace(/[^a-z0-9]/g, '');
          // Check if the place address contains significant parts of user's location
          if (placeAddressNormalized.includes(userLocationNormalized) || 
              userLocationNormalized.includes(placeAddressNormalized.slice(0, 20))) {
            console.log(`[PlacesAgent] Filtering out user's location: ${place.name} at ${place.formatted_address}`);
            return false;
          }
        }
        
        return true;
      })
      .map((place: any) => {
        // Build photo URL from photo_reference if available
        let photoUrl: string | undefined;
        if (place.photos && place.photos.length > 0 && place.photos[0].photo_reference) {
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${config.googleMapsApiKey}`;
        }
        
        return {
          name: place.name,
          address: place.formatted_address,
          rating: place.rating,
          priceLevel: place.price_level,
          types: place.types || [],
          location: {
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng
          },
          placeId: place.place_id,
          userRatingsTotal: place.user_ratings_total,
          photoUrl
        };
      });
    
    // Add new place IDs to the seen set
    if (excludePlaceIds) {
      for (const place of places) {
        excludePlaceIds.add(place.placeId);
      }
    }

    console.log(`[PlacesAgent] Found ${places.length} new places (filtered from ${data.results?.length || 0})`);
    return places;
  }

  protected async evaluateResults(
    results: PlaceResult[],
    context: AgentContext
  ): Promise<EvaluationResult> {
    // Build the evaluation prompt with error history if available
    const errorContext = context.errorHistory 
      ? this.formatErrorHistoryForPrompt(context.errorHistory)
      : '';
    
    const prompt = PLACES_EVAL_PROMPT
      .replace('{goal}', context.goal)
      .replace('{location}', context.location || 'Not specified')
      .replace('{budget}', context.budget || 'Not specified')
      .replace('{results}', JSON.stringify(results.slice(0, 15), null, 2))
      .replace('{radius}', String(this.defaultRadius))
      + errorContext;

    try {
      const response = await this.callLLM(prompt);
      const evaluation = this.parseJsonResponse<{
        sufficient: boolean;
        score: number;
        gaps: string[];
        extracted: any[];
        refinement?: {
          action: string;
          params: Record<string, any>;
        };
      }>(response);

      // Map extracted results back to original data to preserve all fields (especially photoUrl)
      const extractedWithFullData = (evaluation.extracted || []).map((extracted: any) => {
        const original = results.find(r => r.placeId === extracted.placeId);
        return original || extracted;
      });

      return {
        sufficient: evaluation.sufficient,
        score: evaluation.score,
        gaps: evaluation.gaps || [],
        extracted: extractedWithFullData.length > 0 ? extractedWithFullData : results.slice(0, 10),
        refinement: evaluation.refinement
      };
    } catch (error) {
      console.error('[PlacesAgent] Evaluation error:', error);
      // Fallback: if we have decent results, consider it sufficient
      const hasGoodResults = results.filter(r => r.rating && r.rating >= 4.0).length >= 3;
      return {
        sufficient: hasGoodResults,
        score: hasGoodResults ? 6 : 3,
        gaps: ['Evaluation failed, using heuristic'],
        extracted: results.slice(0, 10)
      };
    }
  }

  protected getResultKey(result: PlaceResult): string {
    return result.placeId;
  }
}

