# Layer 0-9 Flow: Strategy Idea → Final Post

## Overview

This document explains how the system transforms a selected **Layer 0 strategy idea** into a complete post with text, hashtags, emojis, and platform-specific CTAs.

---

## 📋 What Layer 0 Provides (Strategy Stage)

When a strategy is generated, each `PostIdea` includes:

```typescript
{
  id: 1,
  title: "Faust Gryde i vintervejr",          // Short title
  rationale: "Signaturret og folk er sultne",  // Why this idea
  content_type: 'menu_item',                   // Type of post
  suggested_day: "2024-02-19",                 // ISO date
  suggested_time: "11:00",                     // HH:mm
  platforms: ['facebook', 'instagram'],        // Target platforms
  cta_intent: 'booking',                       // What CTA should achieve
  
  // 🎬 MEDIA DIRECTION (passed through to Design stage)
  suggested_media: {
    type: 'photo_reel',                        // photo | photo_reel | carousel
    direction: "Nærbillede af retten med naturligt lys",
    why: "Reels får 2x mere rækkevidde",
    photo_count: 2                             // For reels/carousels
  },
  
  // Performance hints
  estimated_performance: 'high',
  strategic_fit: 0.95
}
```

**Key Points:**
- ✅ Photo/reel idea: `suggested_media` object  
- ✅ Posting time: `suggested_day` + `suggested_time`  
- ✅ Platform targeting: `platforms` array (respects user's active platforms)
- ✅ CTA intent: `cta_intent` (booking/engagement/awareness/event_promo/traffic)

These are **passed through** to Design and Publish stages - **no processing needed in Write stage**.

---

## ✍️ Write Stage: Idea → Text

### Entry Point
User selects an idea from strategy and enters **Write stage** (`StrategicPostCreationPage` > `GenerateStep`).

### User Actions
1. **Manual Entry**: User types their own text
2. **AI Enhance**: Click "Forbedr med AI" button → `handleAIUpdate()`

### AI Enhancement Flow

**File**: `src/hooks/usePostCreationAI.ts` → `handleAIUpdate()`

```typescript
// 1. Validates user input
if (!text || wordCount <= 3) {
  showError('Enter meaningful text first')
  return
}

// 2. Gathers business context
const businessProfile = {
  business_name: "Café Faust",
  country: "DK",
  city: "Copenhagen",
  menu_structure: {...},  // From business_profile table
  opening_hours: {...}
}

// 3. Calls AI Enhance endpoint
POST /functions/v1/ai-enhance
{
  text: "Vores Faust Gryde er perfekt til koldt vejr",
  headline: "Faust Gryde",
  platforms: ['facebook', 'instagram'],
  includeEmojis: true,
  includeHashtags: true,
  businessProfile: {...},
  language: 'da'
}
```

**Endpoint**: `supabase/functions/ai-enhance/index.ts`

This endpoint generates:
- ✅ **Enhanced text** (improved readability, tone, structure)
- ✅ **Hashtags** (platform-specific, grouped by category)
- ✅ **Emojis** (embedded in text)

**Hashtag Grouping**:
```typescript
{
  primary: ["#CaféFaust", "#KøbenhavnFood"],      // Shared across all platforms
  local: ["#NørrebroMad", "#CphEats"],            // Shared across all platforms
  foodie: ["#FoodPorn", "#InstaFood"],            // Instagram ONLY
  extras: ["#YummyInMyTummy", "#Foodie"]          // Instagram ONLY
}
```

**Platform Assignment**:
- Facebook: primary + local hashtags ONLY
- Instagram: primary + local + foodie + extras (all 4 groups)

**Result**:
User now has:
- Enhanced text with emojis
- Platform-specific hashtags
- Ready to move to Design stage

---

## 🎨 Design Stage: Add Visuals

### What Happens
- User uploads photo(s) based on `suggested_media.direction` from Layer 0
- System stores media in `photoContent` state
- If `suggested_media.type === 'photo_reel'`, Design stage prepares for reel creation

### Data Passed Through
```typescript
{
  suggested_media: {
    type: 'photo_reel',
    direction: "Nærbillede af retten med naturligt lys",
    photo_count: 2
  },
  uploadedMedia: [
    { url: "...", file: File },
    { url: "...", file: File }
  ]
}
```

No text processing here - just visual preparation.

---

## 📤 Publish Stage: Platform-Specific Finalization

### Entry Point
`PublishStep` component receives:
- Text with emojis
- Platform-specific hashtags
- Media files
- `cta_intent` from Layer 0
- `suggested_day` + `suggested_time` from Layer 0

### Platform-Specific CTA Generation

**Based on `cta_intent` from Layer 0:**

#### Facebook (allows direct links):
```typescript
intent: 'booking' → "Book bord nu: https://cafe-faust.dk/booking"
intent: 'traffic' → "Se menuen: https://cafe-faust.dk/menu"
intent: 'engagement' → "Hvad er din favorit? Kommenter nedenfor!"
intent: 'awareness' → "Del med en ven der elsker god mad 🍽️"
intent: 'event_promo' → "Tilmeld dig her: [Facebook Event link]"
```

#### Instagram (no clickable links in posts):
```typescript
intent: 'booking' → "Book bord - link i bio 📲"
intent: 'traffic' → "Se menuen - link i bio 📱"
intent: 'engagement' → "Tag en ven der skal med! 👇"
intent: 'awareness' → "Gem til senere ✨"
intent: 'event_promo' → "Swipe up i stories for detaljer!"
```

### Hashtag Filtering

**Facebook Post**:
```
[Enhanced text with emojis]

#CaféFaust #KøbenhavnFood #NørrebroMad #CphEats
```
(Only primary + local hashtags)

**Instagram Post**:
```
[Enhanced text with emojis]

#CaféFaust #KøbenhavnFood #NørrebroMad #CphEats #FoodPorn #InstaFood #YummyInMyTummy #Foodie
```
(All 4 hashtag groups)

### Scheduling

Prefills from Layer 0:
- Date: `suggested_day` (2024-02-19)
- Time: `suggested_time` (11:00)

User can adjust before publishing.

---

## 🔄 Alternative Flow: AI Caption Generator (Layer 8)

**Used in**: Weekly plan generation (future automation)

**File**: `supabase/functions/_shared/ai-caption-generator/index.ts`

### Input Context
```typescript
{
  businessName: "Café Faust",
  businessCategory: "café",
  country: "DK",
  
  brandVoice: {
    tone_keywords: ["hyggelig", "lokal"],
    signature_phrases: ["ved åen", "siden 2008"],
    never_say: ["billig", "hurtigmad"],
    typical_openings: ["Der er en grund til..."],
    typical_closings: ["Vi ses ☕"],
    humor_level: 'subtle',
    formality: 'casual',
    emoji_style: 'moderate'
  },
  
  contentOpportunity: {
    type: 'menu_item',
    subject: "Faust Gryde",
    menuItem: {
      name: "Faust Gryde",
      description: "Vintergryde med...",
      category: "Hovedretter",
      price: "145 kr"
    }
  },
  
  temporalContext: {
    season: 'winter',
    dayOfWeek: "Monday",
    timeOfDay: 'lunch',
    servicePeriod: 'lunch',
    weather: "Cold",
    upcomingEvents: ["Valentinsdag"]
  },
  
  platform: 'instagram',
  format: 'photo_reel'
}
```

### AI Prompt Builder

**File**: `supabase/functions/_shared/ai-caption-generator/prompt-builder.ts`

Constructs comprehensive prompt:
```
Du er social media-ekspert for cafeer i Danmark.

FORRETNING: Café Faust (café, København)

INDHOLD:
Type: menu_item | Emne: Faust Gryde
⚠️ VIGTIGT: Forklar hvad "Faust Gryde" er - ikke bare nævn navnet!
Beskrivelse: Vintergryde med...
Kategori: Hovedretter
Pris: 145 kr

PLATFORM: Instagram
Format: photo_reel
Max tegn: 2200 (optimal: 125-300)
Emojis: 2-4 stk, naturligt placeret
Hashtags: 8-12 stk

BRAND VOICE:
Tone: hyggelig, lokal
Typiske åbninger: "Der er en grund til..."
Typiske afslutninger: "Vi ses ☕"
Undgå ALT I VERSALER, salgssprog
Humor: Subtil
Emoji-stil: Moderat

KONTEKST:
Årstid: Vinter | Dag: Mandag | Tid: Frokost
Vejr: Koldt
Events: Valentinsdag (om 5 dage)

HASHTAG-STRATEGI (DK):
1. Brand: #CaféFaust
2. Lokale: #NørrebroMad #KøbenhavnFood #CphEats
3. Foodie (kun IG): #FoodPorn #InstaFood
4. Ekstra (kun IG): #Foodie #YummyFood

OPGAVE:
Lav en Instagram Reel-tekst på dansk (125-300 tegn) der:
1. Hook: Fang opmærksomhed med "Faust Gryde"-benefits
2. Beskrivelse: Forklar hvad det er + perfekt til koldt vintervejr
3. CTA: "Link i bio for booking"

Return ONLY valid JSON:
{
  "caption": "Full Danish caption...",
  "hashtags": ["#Tag1", "#Tag2"],
  "emojis": ["🍽️", "✨"],
  "tone_applied": "warm, inviting",
  "hook": "Opening hook",
  "main_message": "Core message",
  "cta": "Call to action"
}
```

### Output
```json
{
  "caption": "Der er en grund til folk kommer tilbage for Faust Gryde 🍲 Vores vintergryde med mørt oksekød, rodfrugter og friske urter varmer perfekt på en kold mandag. Perfekt til frokost ved åen ✨ Book bord - link i bio",
  "hashtags": [
    "#CaféFaust",
    "#NørrebroMad",
    "#KøbenhavnFood",
    "#CphEats",
    "#FoodPorn",
    "#InstaFood",
    "#Foodie",
    "#YummyFood"
  ],
  "emojis": ["🍲", "✨"],
  "tone_applied": "warm, hyggelig, inviting",
  "hook": "Der er en grund til folk kommer tilbage for Faust Gryde",
  "main_message": "Vintergryde med mørt oksekød - perfekt til koldt vejr",
  "cta": "Book bord - link i bio"
}
```

---

## 🔍 Summary: Layer Responsibilities

| Layer | Responsibility | Output |
|-------|---------------|--------|
| **Layer 0** | Strategic planning | `PostIdea` with media direction, timing, platforms, CTA intent |
| **Layer 1-4** | Business data (existing) | Menu, brand profile, performance data |
| **Layer 5** | Content scoring (legacy) | Priority scores (skipped when strategy exists) |
| **Layer 6** | Timing optimization (legacy) | Optimal post slots (uses Layer 0's suggested_day/time) |
| **Layer 7** | Media format selection (legacy) | Format + platform (uses Layer 0's suggested_media) |
| **Layer 8** | AI caption generation | Text + hashtags + emojis + structure |
| **Layer 9** | Final assembly | Complete post spec ready for publishing |

---

## 🎯 Current Implementation Status

### ✅ Working Today
1. **Write Stage (Manual + AI Enhance)**:
   - User types text OR clicks "Forbedr med AI"
   - `handleAIUpdate()` → `/ai-enhance` endpoint
   - Returns: enhanced text + platform-specific hashtags + emojis
   - Platform-aware hashtag grouping (Facebook vs Instagram)

2. **Design Stage**:
   - Pass through `suggested_media` from Layer 0
   - User uploads photos based on media direction
   - No text processing

3. **Publish Stage**:
   - Prefill date/time from Layer 0
   - Generate platform-specific CTA based on `cta_intent`
   - Filter hashtags by platform
   - User reviews and publishes

### 🚧 Future Automation (Layer 8 Direct)
When we want fully automated post generation:
- Use `generateAICaption()` directly from Layer 0 idea
- Skip manual Write stage
- Generate complete post in one step:
  ```typescript
  const idea = selectedStrategyIdea;
  const context = buildCaptionContext(idea, brandVoice, business);
  const caption = await generateAICaption(context);
  // Caption includes text + hashtags + emojis + CTA
  ```

---

## 🔗 Platform-Specific Logic

### Facebook
```typescript
platforms: ['facebook']

// Hashtags: primary + local ONLY
hashtags: ["#CaféFaust", "#KøbenhavnFood", "#NørrebroMad"]

// CTA: Direct links allowed
cta_intent: 'booking' → "Book bord nu: https://cafe-faust.dk/booking"
cta_intent: 'traffic' → "Se menuen: https://cafe-faust.dk/menu"
```

### Instagram
```typescript
platforms: ['instagram']

// Hashtags: ALL 4 groups
hashtags: [
  "#CaféFaust",           // primary
  "#KøbenhavnFood",       // local
  "#NørrebroMad",         // local
  "#FoodPorn",            // foodie (IG only)
  "#InstaFood",           // foodie (IG only)
  "#Foodie",              // extras (IG only)
  "#YummyFood"            // extras (IG only)
]

// CTA: "Link i bio" pattern
cta_intent: 'booking' → "Book bord - link i bio 📲"
cta_intent: 'traffic' → "Se menuen - link i bio 📱"
```

### Both Platforms
```typescript
platforms: ['facebook', 'instagram']

// Strategy: Create universal content
// Details adapted per platform in final generation:
// - FB: Direct links + fewer hashtags
// - IG: "Link i bio" + full hashtag suite
```

---

## 📝 Code References

### Write Stage Enhancement
- **Hook**: `src/hooks/usePostCreationAI.ts` (line 714)
- **Endpoint**: `supabase/functions/ai-enhance/index.ts`
- **Hashtag Logic**: Lines 960-1045 in `usePostCreationAI.ts`

### AI Caption Generator (Layer 8)
- **Main**: `supabase/functions/_shared/ai-caption-generator/index.ts`
- **Prompt Builder**: `supabase/functions/_shared/ai-caption-generator/prompt-builder.ts`
- **Platform Config**: `supabase/functions/_shared/ai-caption-generator/platform-config.ts`
- **Types**: `supabase/functions/_shared/ai-caption-generator/types.ts`

### Strategy Types (Layer 0)
- **PostIdea**: `supabase/functions/_shared/post-helpers/types/strategy-types.ts` (line 237)

### Weekly Plan Generator (Layer 9)
- **Assembly**: `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`

---

## 🎉 Key Takeaway

**Layer 0 provides EVERYTHING strategic:**
- ✅ What to post (idea + rationale)
- ✅ When to post (date + time)
- ✅ Where to post (platforms)
- ✅ How to shoot it (media direction)
- ✅ What action to drive (CTA intent)

**Write Stage (Layer 1-9) adds EXECUTION:**
- ✅ Actual text (manual or AI-enhanced)
- ✅ Platform-specific hashtags
- ✅ Embedded emojis
- ✅ Platform-appropriate CTAs

**The flow is clean**: Strategy → Text → Design → Publish
