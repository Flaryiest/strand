# Location Feature - Secure Backend Proxy Architecture

## Overview

The location feature in Strand allows users to:
- Auto-detect their current location using browser geolocation
- Manually search and select locations using Google Places autocomplete
- Store location locally (localStorage) and remotely (PostgreSQL database)
- Use location data for personalized trip planning

**Security Architecture**: All Google Maps API calls are proxied through the backend to keep the API key secure and never exposed to the frontend/client-side code.

## Setup Instructions

### 1. Google Maps API Key Configuration

#### Get Your API Key:
1. Visit [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Create a new project or select existing one
3. Enable these APIs:
   - **Places API** (for autocomplete suggestions)
   - **Geocoding API** (for reverse geocoding)
4. Create credentials → API key
5. Restrict your API key (recommended):
   - **Application restrictions**: IP addresses (your backend server IP)
   - **API restrictions**: Places API, Geocoding API only

#### Add to Backend Environment:
Edit `api/.env`:
```env
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

**Important**: The API key should ONLY be in the backend `.env` file, never in frontend code.

### 2. Install Dependencies

The required package is already installed, but if needed:
```bash
cd api
npm install @googlemaps/google-maps-services-js
```

### 3. Verify Backend Routes

The backend already has these proxy endpoints configured in `api/src/routes/maps.routes.ts`:

- `GET /maps/autocomplete?input=<search_text>` - Get place suggestions
- `GET /maps/geocode?lat=<latitude>&lng=<longitude>` - Reverse geocode coordinates to address
- `GET /maps/place-details?placeId=<place_id>` - Get place coordinates and details

These are automatically mounted in `api/src/app.ts` at `/maps`.

## Architecture

### Data Flow

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ 1. User types location
       │ 2. Requests autocomplete
       ▼
┌─────────────────┐
│ LocationInput   │  (Component)
│   Component     │  Calls: fetch('/maps/autocomplete')
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Backend API   │  (Express Server)
│  /maps routes   │  Has: GOOGLE_MAPS_API_KEY
└──────┬──────────┘
       │ 3. Makes secure API call
       ▼
┌─────────────────┐
│  Google Maps    │
│      API        │  Returns: Place suggestions
└──────┬──────────┘
       │ 4. Results flow back
       ▼
┌─────────────────┐
│   Frontend      │  Shows: Dropdown with cities
│                 │  Saves: localStorage + Database
└─────────────────┘
```

### Security Benefits

✅ API key never exposed in browser/network requests  
✅ Can implement rate limiting on backend  
✅ Can cache responses to reduce API costs  
✅ Can monitor and log all API usage  
✅ Can validate requests before calling Google  
✅ Works without loading Google Maps JavaScript library  

## Usage

### Automatic Location Detection

On first visit to chat page:
1. Browser requests geolocation permission
2. If granted, gets latitude/longitude
3. Backend reverse geocodes to city name
4. Saves to localStorage and database

### Manual Location Search

1. User types in location input field
2. After 2+ characters, autocomplete suggestions appear
3. User selects a city from dropdown
4. Backend fetches place details (coordinates)
5. Location saved locally and to database

### Location Storage

**Local (localStorage)**:
- Key: `userLocation` - Location name string
- Key: `userCoordinates` - JSON with lat/lng
- Purpose: Fast access, offline availability

**Remote (PostgreSQL)**:
- Table: `User`
- Column: `location` (String)
- Purpose: Persistent storage, cross-device sync

## API Endpoints Reference

### GET /maps/autocomplete

**Query Parameters**:
- `input` (string, required): Search text (min 2 characters)

**Response**:
```json
{
  "suggestions": [
    {
      "placeId": "ChIJ...",
      "description": "San Francisco, CA, USA"
    }
  ]
}
```

### GET /maps/geocode

**Query Parameters**:
- `lat` (number, required): Latitude
- `lng` (number, required): Longitude

**Response**:
```json
{
  "location": "San Francisco, CA",
  "coordinates": {
    "lat": 37.7749,
    "lng": -122.4194
  }
}
```

### GET /maps/place-details

**Query Parameters**:
- `placeId` (string, required): Google Place ID

**Response**:
```json
{
  "coordinates": {
    "lat": 37.7749,
    "lng": -122.4194
  },
  "formattedAddress": "San Francisco, CA, USA"
}
```

## Error Handling

### Geolocation Errors

- **Permission Denied**: User must enable location in browser settings
- **Position Unavailable**: GPS/location services disabled
- **Timeout**: Network issues or weak GPS signal

### API Errors

- **400 Bad Request**: Missing or invalid parameters
- **401 Unauthorized**: Authentication required (JWT cookie)
- **500 Server Error**: Google API issue or backend error

## Troubleshooting

### Location not auto-detecting
1. Check browser location permissions (Settings → Privacy)
2. Ensure HTTPS (geolocation requires secure context)
3. Verify backend is running and accessible
4. Check browser console for errors

### Autocomplete not working
1. Verify `GOOGLE_MAPS_API_KEY` is set in `api/.env`
2. Ensure Places API is enabled in Google Cloud Console
3. Check API key restrictions aren't blocking requests
4. Verify backend `/maps` routes are accessible
5. Check browser console network tab for failed requests

### Location not saving to backend
1. Verify user is authenticated (JWT cookie present)
2. Check backend logs for errors
3. Test endpoint: `PUT /auth/location` with body `{"location": "Test"}`
4. Ensure database connection is working

### Backend proxy returns 500 error
1. Verify API key is correct and active
2. Check API quota in Google Cloud Console
3. Ensure correct APIs are enabled (Places API, Geocoding API)
4. Review backend console logs for detailed error messages

## Cost Optimization

### Caching Strategy (Future Enhancement)

Consider implementing Redis caching for:
- Autocomplete results (cache for 1 hour)
- Geocoding results (cache for 24 hours)
- Place details (cache for 7 days)

### Rate Limiting

Already protected by backend, but can add:
- Per-user request limits
- IP-based throttling
- Debouncing on frontend (currently 0ms, can increase)

## Development vs Production

### Development
- API key in `api/.env` file
- No IP restrictions (for local testing)
- Localhost CORS enabled

### Production
- API key in environment variables (Railway, Vercel, etc.)
- IP restrictions enabled (backend server IP only)
- Production domain CORS configured
- Consider separate API key with stricter limits

## Related Files

**Backend**:
- `api/src/routes/maps.routes.ts` - Proxy endpoints
- `api/src/app.ts` - Route mounting
- `api/src/routes/auth.routes.ts` - Location update endpoint
- `api/src/database/queries.ts` - `updateUserLocation()`

**Frontend**:
- `web/src/components/locationInput/locationInput.tsx` - Location input UI
- `web/src/stores/location.ts` - Zustand store with geolocation
- `web/src/pages/chat/chat.tsx` - Integration point

**Database**:
- `api/prisma/schema.prisma` - User model with location field
