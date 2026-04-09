# Post Idea Generator - Phase 2 Complete

## Deployment Status

✅ **Deployed:** post-idea-generator (132kB)  
✅ **Endpoint:** `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/post-idea-generator`  
🕐 **Date:** January 8, 2026

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         POST IDEA GENERATION FLOW               │
└─────────────────────────────────────────────────┘

1. Load Brand Profile (cached, 1hr TTL)
   ↓
2. Gather Dynamic Context
   - Time of day (morning/afternoon/evening/night)
   - Day of week + weekend detection
   - Season (spring/summer/autumn/winter)
   - Weather (placeholder for future API)
   ↓
3. Build Prompt
   - Brand Profile DNA (tone, focus, pillars, avoid-list)
   - Dynamic Context (timing, season, angles)
   - User Input (optional: draft, goal, platform)
   ↓
4. Generate Ideas (GPT-4o)
   - 3 post ideas with captions
   - Photo/reel suggestions
   - Best time recommendations
   - Optional: Refined draft caption
   ↓
5. Return JSON Response
```

---

## API Reference

### Endpoint
```
POST /functions/v1/post-idea-generator
```

### Request Body
```json
{
  "businessId": "uuid-string",          // Required
  "draft": "User's draft text",         // Optional
  "goal": "Drive brunch bookings",      // Optional
  "platform": "Instagram"               // Optional
}
```

### Response
```json
{
  "success": true,
  "requestId": "post-abc123",
  "durationMs": 1500,
  "brandProfile": {
    "qualityStatus": "green",
    "versionHash": "a1b2c3d4"
  },
  "context": {
    "timeOfDay": "morning",
    "dayOfWeek": "Saturday",
    "season": "winter",
    "timingAdvice": "Best time: Weekend mornings (10-11 AM) for brunch content"
  },
  "ideas": [
    {
      "angle": "Saturday morning brunch angle - cozy winter atmosphere",
      "caption": "Start din lørdag morgen med en rolig brunch ved åen. Varme retter og god tid til at blive siddende. 🥐☕",
      "photoSuggestion": {
        "scene": "Table by window overlooking the river",
        "subject": "Brunch plate with coffee, steam rising",
        "lighting": "Soft morning light through window",
        "composition": "Close-up of food with blurred river view background"
      },
      "bestTime": "Saturday 10:00 AM",
      "pillarUsed": "Food & Service Experience"
    },
    {
      "angle": "Weekend leisure - slow pace dining",
      "caption": "Når du har hele dagen foran dig. Kom ned til os og nyd måltidet i dit eget tempo. Perfekt til lange samtaler.",
      "photoSuggestion": {
        "scene": "Guests lingering over coffee",
        "subject": "Two people in conversation, relaxed posture",
        "lighting": "Natural daylight, warm interior tones",
        "composition": "Medium shot capturing atmosphere and interaction"
      },
      "bestTime": "Saturday 11:30 AM",
      "pillarUsed": "Moments & Transitions"
    },
    {
      "angle": "Winter comfort food - seasonal relevance",
      "caption": "Kulde udenfor, hygge indenfor. Vores pariserbøf varmer dig op på selv de koldeste dage. 🍽️",
      "photoSuggestion": {
        "scene": "Steaming plate of pariserbøf",
        "subject": "Classic dish with bearnaise sauce",
        "lighting": "Warm overhead lighting",
        "composition": "Overhead shot, shallow depth of field"
      },
      "bestTime": "Saturday 12:00 PM",
      "pillarUsed": "Signature Dishes"
    }
  ],
  "refinedCaption": null  // Only present if draft was provided
}
```

---

## Features

### 1. Brand Profile Caching
- **In-memory cache:** Loaded once, reused for 1 hour
- **Performance:** ~50ms for cached profiles (vs ~200ms cold load)
- **Auto-refresh:** Cache expires after 1 hour, ensures up-to-date profiles

### 2. Dynamic Context
**Time-based:**
- Time of day detection (morning/afternoon/evening/night)
- Weekend vs weekday awareness
- Season detection (spring/summer/autumn/winter)

**Contextual Angles (auto-generated):**
- Morning → brunch/morgenmad angle
- Afternoon → frokost/pausemoment angle  
- Evening → aftenmad/dining angle
- Weekend → leisure/slow pace angle
- Summer → outdoor seating/fresh ingredients
- Winter → cozy interior/comfort food

### 3. Smart Prompting
**Includes from Brand Profile:**
- Brand essence (one-liner)
- Tone of voice rules
- Content focus areas
- Content pillars
- Things to avoid (hard constraints)
- Voice examples (for style reference)

**Combines with Dynamic Context:**
- Current time → timing-relevant angles
- Season → seasonal menu/atmosphere suggestions
- Day of week → audience behavior patterns

### 4. Output Quality
**Each idea includes:**
- **Angle:** Why this post is relevant NOW
- **Caption:** Ready-to-use text in brand voice
- **Photo Suggestion:** Specific shot description (scene, subject, lighting, composition)
- **Best Time:** When to post for maximum engagement
- **Pillar Used:** Which content pillar this serves

**Optional Enhancement:**
- If user provides draft → AI refines it while preserving core message

---

## Use Cases

### Use Case 1: Daily Content Planning
```bash
curl -X POST 'https://.../post-idea-generator' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "businessId": "uuid",
    "goal": "Drive lunch bookings"
  }'
```

**Expected Output:** 3 ideas tailored to current time of day, with lunch-focused angles

### Use Case 2: Caption Enhancement
```bash
curl -X POST 'https://.../post-idea-generator' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "businessId": "uuid",
    "draft": "Kom og spis brunch hos os i dag",
    "platform": "Instagram"
  }'
```

**Expected Output:** 3 new ideas + refined version of draft with better style/hooks

### Use Case 3: Platform-Specific Content
```bash
curl -X POST 'https://.../post-idea-generator' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "businessId": "uuid",
    "platform": "Facebook",
    "goal": "Community engagement"
  }'
```

**Expected Output:** Ideas with longer captions suitable for Facebook's format

---

## Technical Details

### Performance
- **Cache hit:** ~50ms (Brand Profile from memory)
- **Cache miss:** ~200ms (Database query)
- **AI generation:** ~1-2 seconds (GPT-4o)
- **Total (typical):** ~1.5-2.5 seconds

### Caching Strategy
```typescript
// In-memory Map (persists across requests in same isolate)
const brandProfileCache = new Map<string, {
  profile: any
  locale: any
  loadedAt: number
}>()

// TTL: 1 hour (3600000ms)
// Automatically refreshes when Brand Profile regenerates
```

### Error Handling
- Missing Brand Profile → 400 error with clear message
- OpenAI timeout → Automatic retry (inherited from shared functions)
- Invalid JSON → Fallback parsing with error context

---

## Example Logs

### Successful Generation
```
[post-abc123] 📬 Incoming post idea generation request
[post-abc123] 📚 Loading Brand Profile...
📦 Brand Profile loaded from cache (age: 234s)
[post-abc123] 🌤️ Gathering dynamic context...
[post-abc123] 📊 Context: {
  timeOfDay: "morning",
  dayOfWeek: "Saturday",
  season: "winter",
  anglesCount: 5
}
[post-abc123] 🤖 Generating post ideas...
[post-abc123] ✅ Generated 3 ideas in 1,847ms
```

### Cache Miss (First Request)
```
[post-xyz789] 📬 Incoming post idea generation request
[post-xyz789] 📚 Loading Brand Profile...
🔍 Loading Brand Profile from database...
✅ Brand Profile loaded and cached (version: a1b2c3d4...)
[post-xyz789] 🌤️ Gathering dynamic context...
[... continues ...]
```

---

## Future Enhancements

### Phase 2.1 - Weather Integration
```typescript
// Replace placeholder with real API
const weather = await fetchWeatherAPI(locale.city)
// Enables: "Solskin i dag → outdoor seating angle"
```

### Phase 2.2 - Event Integration
```typescript
const events = await fetchLocalEvents(locale.city, date)
// Enables: "Concert tonight → pre-show dinner angle"
```

### Phase 2.3 - Recent Posts Context
```typescript
const recentPosts = await fetchRecentPosts(businessId, days: 7)
// Enables: "Last 3 posts about food → suggest atmosphere post"
```

### Phase 2.4 - Performance Tracking
```typescript
const topPosts = await fetchTopPerformingPosts(businessId)
// Enables: "Posts with river photos get 2x engagement → suggest waterfront shot"
```

### Phase 2.5 - Multi-Platform Optimization
```typescript
if (platform === 'Instagram') {
  // Shorter captions, emoji-heavy, hashtag suggestions
} else if (platform === 'Facebook') {
  // Longer storytelling, community questions
}
```

---

## Testing Checklist

### Manual Tests

1. **Basic Generation:**
   - ✅ Call with just businessId
   - ✅ Verify 3 ideas returned
   - ✅ Check captions match brand tone

2. **Cache Performance:**
   - ✅ First call: ~2 seconds (cache miss)
   - ✅ Second call: ~1.5 seconds (cache hit)
   - ✅ Check logs show "loaded from cache"

3. **Draft Enhancement:**
   - ✅ Send draft text
   - ✅ Verify refinedCaption in response
   - ✅ Check it improves style while keeping message

4. **Dynamic Context:**
   - ✅ Test morning call → brunch angles
   - ✅ Test evening call → dinner angles
   - ✅ Test weekend → leisure angles

5. **Brand Consistency:**
   - ✅ Check "things to avoid" are excluded
   - ✅ Verify distinctive hooks appear in some captions
   - ✅ Confirm tone matches voice examples

### Database Queries

```sql
-- Check Brand Profiles with quality status
SELECT business_id, quality_status, version_hash, created_at
FROM business_brand_profile
ORDER BY created_at DESC
LIMIT 10;

-- Find businesses ready for post generation
SELECT b.id, b.name, bp.quality_status
FROM businesses b
INNER JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE bp.quality_status IN ('green', 'yellow')
ORDER BY bp.created_at DESC;
```

---

## Integration Guide

### Frontend Integration

**React Component Example:**
```tsx
const GeneratePostIdeas = ({ businessId }) => {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(false)
  
  const handleGenerate = async () => {
    setLoading(true)
    
    const response = await fetch(
      'https://.../post-idea-generator',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ businessId })
      }
    )
    
    const data = await response.json()
    setIdeas(data.ideas)
    setLoading(false)
  }
  
  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Genererer idéer...' : '✨ Få post idéer'}
      </button>
      
      {ideas.map((idea, i) => (
        <PostIdeaCard key={i} idea={idea} />
      ))}
    </div>
  )
}
```

### CLI Testing
```bash
# Test basic generation
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/post-idea-generator' \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"YOUR_BUSINESS_ID"}' | jq '.ideas[0]'

# Test with draft
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/post-idea-generator' \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId":"YOUR_BUSINESS_ID",
    "draft":"Kom og spis brunch"
  }' | jq '.refinedCaption'
```

---

## Monitoring

### Key Metrics to Track
- **Cache hit rate:** Should be >80% after warm-up
- **Generation time:** Should average 1.5-2.5 seconds
- **Error rate:** Should be <1% (mainly missing profiles)
- **Ideas per request:** Always 3 unless error

### Supabase Dashboard
Monitor at: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/logs/edge-functions?id=post-idea-generator

---

## Phase 2 Status

✅ **Complete:**
- Brand Profile loading with caching
- Dynamic context gathering (time, season, weekend)
- Post idea generation prompt
- Photo/reel suggestion system
- Timing recommendations
- Draft enhancement feature

⏳ **Future:**
- Weather API integration
- Event calendar integration
- Recent posts context
- Performance-based suggestions
- Multi-platform optimization

**Phase 2 Production Ready** 🚀
