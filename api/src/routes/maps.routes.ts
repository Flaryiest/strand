import express, { Request, Response } from 'express';
import { Client } from '@googlemaps/google-maps-services-js';

const maps = express.Router();
const client = new Client({});

// Autocomplete endpoint - searches for places as user types
maps.get('/autocomplete', async (req: Request, res: Response): Promise<any> => {
  try {
    const { input } = req.query;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input query parameter is required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const response = await client.placeAutocomplete({
      params: {
        input,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK') {
      const suggestions = response.data.predictions.map((prediction) => ({
        placeId: prediction.place_id,
        description: prediction.description
      }));
      res.json({ suggestions });
    } else {
      res.json({ suggestions: [] });
    }
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
});

// Geocode endpoint - converts lat/lng to address (reverse geocoding)
maps.get('/geocode', async (req: Request, res: Response): Promise<any> => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid latitude or longitude' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const response = await client.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const fullAddress = result.formatted_address;

      // Try to extract city and state for cleaner format
      const addressComponents = result.address_components;
      const city = addressComponents.find((comp: any) =>
        comp.types.includes('locality')
      )?.long_name;
      const state = addressComponents.find((comp: any) =>
        comp.types.includes('administrative_area_level_1')
      )?.short_name;

      let locationName = fullAddress;
      if (city && state) {
        locationName = `${city}, ${state}`;
      } else if (city) {
        locationName = city;
      }

      res.json({
        location: locationName,
        fullAddress: fullAddress,
        city: city || null,
        state: state || null,
        coordinates: { lat: latitude, lng: longitude }
      });
    } else {
      res.status(404).json({ error: 'Location not found' });
    }
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
});

// Place details endpoint - gets details for a specific place
maps.get('/place-details', async (req: Request, res: Response): Promise<any> => {
  try {
    const { placeId } = req.query;

    if (!placeId || typeof placeId !== 'string') {
      return res.status(400).json({ error: 'Place ID is required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['geometry', 'formatted_address'],
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    if (response.data.status === 'OK' && response.data.result) {
      const place = response.data.result;
      const coordinates = place.geometry?.location
        ? {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          }
        : null;

      res.json({
        coordinates,
        formattedAddress: place.formatted_address
      });
    } else {
      res.status(404).json({ error: 'Place not found' });
    }
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

export default maps;
