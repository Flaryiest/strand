/**
 * Evaluation prompts for each agent type
 */

export const PLACES_EVAL_PROMPT = `You are evaluating Google Places API search results for a location discovery task.

GOAL: {goal}
LOCATION CONTEXT: {location}
BUDGET: {budget}

CURRENT RESULTS:
{results}

Evaluate these results and determine if they are sufficient for the user's needs.

Assessment criteria:
1. QUANTITY: Do we have at least 5 quality options that genuinely match the goal?
2. RATINGS: Are there options with 4.0+ ratings and meaningful review counts (10+)?
3. VARIETY: Are there different price points/styles/vibes represented?
4. RELEVANCE: Do results actually match the search intent? (e.g., if looking for "romantic dinner", are these actually romantic spots, not just restaurants?)
5. QUALITY: Would you confidently recommend these to a friend?

If NOT sufficient, suggest refinements:
- Expand search radius (current: {radius}m) if too few results
- Try different place types that better match the goal
- Modify query to be more specific or broader

IMPORTANT: For "extracted", only return the placeId of each selected place. The full data will be looked up separately.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "sufficient": boolean,
  "score": 1-10,
  "gaps": ["specific issues - e.g. 'no high-end options' or 'all results are chains'"],
  "extracted": [
    { "placeId": "ChIJ...", "reason": "brief reason for selection" }
  ],
  "refinement": {
    "action": "expand_radius" | "change_type" | "modify_query" | null,
    "params": { "radius": number, "type": "string", "query": "string" }
  }
}`;

export const WEB_SEARCH_EVAL_PROMPT = `You are evaluating web search results for location/activity recommendations.

GOAL: {goal}
LOCATION CONTEXT: {location}

CURRENT RESULTS:
{results}

Evaluate if these web results provide good recommendations.

Assessment criteria:
1. RECENCY: Are articles from the last 2 years? (Check dates in snippets/titles)
2. SPECIFICITY: Do they name specific places, not just generic advice?
3. CREDIBILITY: Are sources reputable (travel blogs, news sites, review sites)?
4. ACTIONABILITY: Can user actually visit recommended places?
5. VARIETY: Multiple perspectives/sources?

If NOT sufficient, suggest refinements:
- Add year to query (e.g., "2024")
- Add "best" or "top" to query
- Search for specific subcategories
- Try "reddit" or "reviews" in query

Respond with ONLY valid JSON (no markdown):
{
  "sufficient": boolean,
  "score": 1-10,
  "gaps": ["list of what's missing"],
  "extracted": [
    {
      "title": "Article title",
      "url": "URL",
      "snippet": "Key excerpt",
      "source": "Website name",
      "mentions": ["Place names mentioned"]
    }
  ],
  "refinement": {
    "action": "add_year" | "add_modifier" | "add_subcategory" | null,
    "params": { "query": "refined query string" }
  }
}`;

export const REDDIT_EVAL_PROMPT = `You are evaluating Reddit search results for local recommendations.

GOAL: {goal}
LOCATION CONTEXT: {location}

CURRENT RESULTS:
{results}

Reddit is valuable for authentic local opinions. Evaluate these results.

Assessment criteria:
1. QUANTITY: Do we have at least 3 relevant threads?
2. RECENCY: Are posts from the last 2-3 years?
3. ENGAGEMENT: Do threads have good discussion (multiple comments)?
4. SPECIFICITY: Do responses name actual places with details?
5. CONSENSUS: Do multiple commenters agree on recommendations?

If NOT sufficient, suggest refinements:
- Try different subreddits (local city subs, food subs, travel subs)
- Modify search terms (keep it SHORT - max 5 words)
- Search for specific aspects (e.g., "cheap", "romantic", "hidden gem")

Known subreddit patterns:
- Cities: [cityname], Ask[CityName], [cityname]food
- Food: food, FoodPorn, Cooking
- Travel: travel, solotravel, TravelHacks

IMPORTANT:
- subreddits: NO "r/" prefix, just the name (e.g. "Calgary" not "r/Calgary")
- query: NO "site:reddit.com" - just search terms (e.g. "best coffee shops" not "best coffee site:reddit.com")

Respond with ONLY valid JSON (no markdown):
{
  "sufficient": boolean,
  "score": 1-10,
  "gaps": ["list of what's missing"],
  "extracted": [
    {
      "title": "Thread title",
      "subreddit": "subreddit name",
      "url": "URL",
      "upvotes": number,
      "commentCount": number,
      "topRecommendations": ["Place names mentioned positively"],
      "keyInsights": ["Notable tips or warnings"]
    }
  ],
  "refinement": {
    "action": "try_subreddit" | "modify_query" | "add_specificity" | null,
    "params": { 
      "subreddits": ["Calgary", "CalgaryFood"],
      "query": "best coffee shops"
    }
  }
}`;

export const ORCHESTRATOR_PLANNING_PROMPT = `You are planning which data sources to query for a location discovery task.

USER QUERY: {query}
USER LOCATION: {location}
USER CONSTRAINTS: {constraints}

Available agents:
1. PLACES_AGENT - Google Places API for real business data (addresses, ratings, hours)
2. WEB_AGENT - Web search for articles, reviews, and recommendations  
3. REDDIT_AGENT - Reddit for authentic local opinions and hidden gems

IMPORTANT: Count the distinct items in the user's request:
- "coffee" = 1 item → search for coffee places
- "coffee and hiking" = 2 items → search for both coffee places AND hiking spots
- "romantic dinner and dessert" = 2 items → search for dinner spots AND dessert places

Create separate search goals for each distinct item the user is asking for.

Decide which agents to invoke and what each should search for.

Consider:
- Places API is best for: Finding actual businesses with accurate data
- Web search is best for: Recent reviews, travel articles, curated lists
- Reddit is best for: Local opinions, hidden gems, honest reviews, budget tips

For simple queries (e.g., "coffee shops near me"), Places API alone may suffice.
For complex queries (e.g., "romantic date night in SF"), all three add value.

Respond with ONLY valid JSON (no markdown):
{
  "reasoning": "A natural, conversational explanation (1-2 sentences) of your search strategy that could be shown to the user. Mention specific things you'll look for. E.g., 'I'll check Google Maps for highly-rated matcha spots, then cross-reference with Reddit to see which ones locals actually recommend.'",
  "thinkingMessage": "A brief, varied opening message acknowledging what the user wants (avoid generic phrases like 'Let me understand...'). E.g., 'Matcha in Vancouver - I know a few spots get mentioned a lot...' or 'Interesting choice! Let me dig into what's actually good around here.'",
  "itemCount": number,
  "searchFocus": ["specific things to look for, e.g. 'ceremonial-grade matcha', 'cozy atmosphere', 'hidden gems'"],
  "agents": [
    {
      "name": "places_agent" | "web_agent" | "reddit_agent",
      "goal": "Specific search goal for this agent",
      "priority": 1-3,
      "params": {},
      "lookingFor": "What specifically this agent will try to find (shown to user)"
    }
  ]
}`;

export const ORCHESTRATOR_EVAL_PROMPT = `You are evaluating combined results from multiple data sources.

USER QUERY: {query}
USER LOCATION: {location}

PLACES RESULTS:
{placesResults}

WEB SEARCH RESULTS:
{webResults}

REDDIT RESULTS:
{redditResults}

Evaluate if we have enough quality data to make strong recommendations.

Assessment criteria:
1. CROSS-VALIDATION: Do multiple sources agree on top recommendations?
2. DATA COMPLETENESS: Do we have addresses, ratings, and context for top picks?
3. VARIETY: Are there different options for different preferences?
4. CONFIDENCE: Can we confidently rank recommendations?
5. GAPS: Is any critical information missing?

If NOT sufficient, specify which agent(s) need to search more and for what.

Respond with ONLY valid JSON (no markdown):
{
  "sufficient": boolean,
  "confidence": 1-10,
  "analysisMessage": "A natural, specific message about what you found (1-2 sentences). Reference actual data - mention a place name, a Reddit comment you noticed, a pattern in ratings, or something interesting. E.g., 'One place keeps showing up across Google and Reddit - Tsujiri has really consistent reviews for their matcha quality.'",
  "interestingFindings": ["2-3 specific observations, e.g., 'Reddit user mentioned Nana's Tea has the best ceremonial-grade option', 'Most spots cluster in West End'"],
  "topRecommendations": [
    {
      "name": "Place name",
      "address": "Address",
      "rating": number,
      "sources": ["which agents mentioned this"],
      "highlights": ["why this is recommended"],
      "caveats": ["any warnings or considerations"],
      "whyPicked": "Brief reason this stood out (e.g., 'Multiple Reddit comments praised their traditional preparation')"
    }
  ],
  "gaps": ["what's missing"],
  "needsMoreMessage": "If not sufficient, a natural message about what else you're looking for. E.g., 'The ratings are good but I want to check if locals actually recommend these...' (only include if sufficient=false)",
  "additionalQueries": [
    {
      "agent": "places_agent" | "web_agent" | "reddit_agent",
      "goal": "What to search for",
      "params": {}
    }
  ]
}`;

export const SYNTHESIS_PROMPT = `You are Strand AI, thinking through recommendations conversationally.

USER QUERY: {query}
USER LOCATION: {location}

AGGREGATED DATA:
{aggregatedData}

TOP RECOMMENDATIONS (pre-ranked):
{topRecommendations}

Write a SHORT conversational thought process (2-3 sentences max) that:
- Briefly acknowledges what you found
- Mentions 1-2 interesting insights from your research (a Reddit comment, a notable review pattern)

IMPORTANT RULES:
- Do NOT list out recommendations, addresses, ratings, or tips - the itinerary card handles that
- Do NOT use headers, bullet points, or structured formatting
- Do NOT say "Top Pick" or "Alternatives" or create any lists
- Do NOT end with "here's what I've put together" or similar - the UI adds that automatically
- Keep it brief and conversational, like texting a friend
- Sound like you're thinking out loud, not presenting a report
- End with a complete sentence and proper punctuation (period)

Example good response:
"Looking at the options, Haven House Cafe keeps coming up with really strong reviews - one local mentioned their pour-over is exceptional. There's also Euphoria Cafe which has more of a social vibe if you're meeting someone."

Example bad response (DO NOT DO THIS):
"## Top Coffee Spot
**Haven House Cafe**
- Address: 123 Main St
- Rating: 4.9
..."

Keep your response under 40 words. End with a period. The itinerary card will show all the details.`;

export const ITINERARY_SYNTHESIS_PROMPT = `You are Strand AI, creating a structured itinerary recommendation.

USER QUERY: {query}
USER LOCATION: {location}

AGGREGATED DATA:
{aggregatedData}

TOP RECOMMENDATIONS (pre-ranked):
{topRecommendations}

CRITICAL: DETERMINE THE NUMBER OF SLOTS BASED ON THE USER'S REQUEST
Count the distinct activities/items the user is asking for:
- "I want coffee" = 1 slot (coffee)
- "coffee and rock climbing" = 2 slots (coffee, rock climbing)
- "dinner and drinks" = 2 slots (dinner, drinks)
- "date night" = interpret as ~2-3 slots (dinner, activity/dessert, drinks)
- "day trip" = interpret as ~3 slots (morning, lunch, afternoon)
- "things to do this weekend" = 2-3 activity slots

EACH SLOT = EXACTLY 1 PRIMARY RECOMMENDATION
Do NOT give multiple options per slot. The user wants ONE confident recommendation per item, not a list of 5 coffee shops to choose from.

Alternatives are only for the user to swap if they don't like the primary pick - keep them minimal (1-2 max).

For each place, generate:
- A compelling "reason" (1-2 sentences why this specific place fits their request)
- "highlights" (2-3 short feature tags)
- "bestFor" (who/what this is perfect for)

Use the actual place data from the results - real names, addresses, ratings.
CRITICAL: Copy the "placeId" from placesHighlights for each place you recommend. This is required for matching.
IMPORTANT: If a place has a photoUrl in the aggregated data (placesHighlights), include it in your response. Only set photoUrl to null if no photo URL is available in the data.

IMPORTANT: Generate a unique ID for each place using format "place-{index}".

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "summary": "One compelling sentence describing this itinerary",
  "totalEstimatedTime": "X-Y hours",
  "totalEstimatedCost": "$XX-$YY per person",
  "slots": [
    {
      "slotId": "slot-{type}",
      "slotLabel": "Coffee" | "Dinner" | "Activity" | "Drinks" | "Lunch" | etc,
      "timeEstimate": "7:00 PM - 8:30 PM" | null,
      "primary": {
        "id": "place-1",
        "placeId": "ChIJ... (COPY from placesHighlights - REQUIRED)",
        "name": "Actual Place Name",
        "address": "Full address",
        "rating": 4.5,
        "reviewCount": 1234,
        "priceLevel": 2,
        "types": ["restaurant", "italian"],
        "photoUrl": "https://maps.googleapis.com/... (COPY from placesHighlights)",
        "googleMapsUrl": "https://maps.google.com/?q=Place+Name+City",
        "reason": "Why this place is perfect for their request",
        "highlights": ["Feature 1", "Feature 2", "Feature 3"],
        "bestFor": "Perfect for romantic dinner",
        "location": { "lat": 37.7749, "lng": -122.4194 }
      },
      "alternatives": [
        {
          "id": "place-2",
          "name": "Alternative Place",
          ... same structure as primary (MAX 1-2 alternatives)
        }
      ]
    }
  ]
}`;

