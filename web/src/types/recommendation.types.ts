/**
 * Structured recommendation data returned by the AI
 */

export interface PlaceRecommendation {
  id: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number; // 1-4 ($-$$$$)
  types: string[];
  photoUrl?: string;
  googleMapsUrl?: string;
  placeId?: string;
  location?: {
    lat: number;
    lng: number;
  };
  // AI-generated content
  reason: string; // Why this was recommended
  highlights?: string[]; // Key features
  bestFor?: string; // "Perfect for romantic dinner"
}

export interface RecommendationSlot {
  slotId: string;
  slotLabel: string; // "Dinner", "Activity", "Dessert"
  slotIcon?: string; // emoji or icon name
  timeEstimate?: string; // "7:00 PM - 8:30 PM"
  primary: PlaceRecommendation;
  alternatives: PlaceRecommendation[];
  selectedIndex: number; // 0 = primary, 1+ = alternatives
}

export interface ItineraryRecommendation {
  id: string;
  summary: string;
  totalEstimatedTime?: string;
  totalEstimatedCost?: string;
  slots: RecommendationSlot[];
  generatedAt: string;
}
