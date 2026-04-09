# LAYER 8: CAPTION & CREATIVE DIRECTION GENERATION

## Overview
Layer 8 generates production-ready content briefs with captions and visual directions. Takes final post specifications from Layer 7 and produces actionable creative directions for content creators.

## Architecture

```
INPUT (from Layer 7)
├─ Content subject (dish/angle)
├─ Format (photo/carousel/reel)
├─ Platform (instagram/facebook/linkedin/tiktok)
├─ Schedule (day, time)
├─ Brand voice (Layer 1)
├─ Season/weather context (Layer 3)
└─ Location amplifiers (Layer 3)
    ↓
LAYER 8 PROCESSING
├─ Caption Generation
│  ├─ Hook (attention grabber)
│  ├─ Core message (what/why)
│  ├─ Context enrichment (season/location)
│  ├─ Call-to-action (based on post type)
│  ├─ Emojis (frequency by brand voice)
│  └─ Platform character limit enforcement
└─ Visual Direction Specification
   ├─ Format-specific directions
   ├─ Technical specs (dimensions, length)
   ├─ Scene-by-scene breakdown
   └─ Alt text (accessibility)
    ↓
OUTPUT: ContentCreationBrief
├─ caption: string (platform-optimized)
├─ visualDirection: {...}
├─ technicalSpecs: {...}
├─ altText: string
├─ schedulingInfo: {...}
└─ contextNotes: string
```

---

## 1. CAPTION GENERATION

### Structure

**5-Part Formula:**
1. **Hook** (First 125 chars - critical for feed truncation)
   - Question: "Ever wondered why our salmon tastes different?"
   - Statement: "Spring on a plate."
   - Intrigue: "This took 6 hours to perfect."

2. **Core Message** (What is this? Why care?)
   - "Pan-seared salmon with spring asparagus"
   - "Our chef sources asparagus daily from local farms"

3. **Context Enrichment** (Season/Weather/Location tie-in)
   - "Perfect for these sunny spring days on the waterfront"
   - "Rainy afternoons call for comfort food in cozy corners"

4. **Call-to-Action** (Soft or direct, based on post type)
   - Menu highlights: "Reserve your table" / "Stop by this week"
   - Behind-scenes: "Want to see more?" / "Follow for daily kitchen stories"
   - Engagement: "What's your spring favorite?" / "Tag a friend who needs this"

5. **Emojis** (Frequency based on brand voice)
   - Playful: 3-5 emojis (🌸🍽️✨)
   - Casual: 2-3 emojis (🌿😊)
   - Refined: 1-2 emojis, subtle (🍃)
   - Professional: 0-1 emojis

### Brand Voice Modifiers

**Casual Voice:**
- Conversational tone
- Questions to audience
- Relatability focus
- Example: "Spring vibes hitting different today 🌸 Our asparagus just arrived from the market this morning, and honestly? Chef's already planning tomorrow's special. What's your go-to spring veggie? Drop it below! 👇"

**Refined Voice:**
- Sophistication and elegance
- Detail-oriented descriptions
- Elevated language
- Example: "Pan-seared salmon, locally sourced asparagus, delicate lemon beurre blanc. Spring dining at its finest, overlooking the harbor. Reserve your experience today. 🍃"

**Playful Voice:**
- Humor and wordplay
- Light, fun tone
- Personality-forward
- Example: "Asparagus season = our chef doing a happy dance in the kitchen 💃🌿 This spring salmon situation is TOO good not to share. Come catch the vibes (and the fish) while it lasts! 🐟✨"

**Professional Voice:**
- Informative and clear
- Trustworthy tone
- Educational angle
- Example: "Sustainably sourced salmon, prepared using traditional pan-searing techniques. Paired with seasonal asparagus from Danish farms. Available this week for lunch and dinner service."

### Context Weaving Patterns

**Location + Season + Weather:**
- Waterfront + Spring + Sunny → "Perfect weather for waterfront dining"
- City Center + Lunch + Weekday → "Quick business lunch done right"
- Cozy Interior + Rainy + Fall → "Rainy days call for hygge"
- Harbor View + Summer + Evening → "Golden hour dining by the water"
- Historic District + Winter + Cold → "Warm up in our historic setting"

**Time of Day + Content Type:**
- Morning + Behind-scenes → "Early morning prep at..."
- Lunch + Menu Highlight → "Lunch special ready..."
- Afternoon + Location Story → "Afternoon light hitting just right..."
- Evening + Atmosphere → "Evening ambiance like no other..."

### Platform Character Limits

**Instagram:**
- Max: 2,200 characters
- Optimal: 125-150 chars (first line before "...more")
- Strategy: Hook in first line, expand after fold

**Facebook:**
- Max: 63,206 characters
- Optimal: 200-400 chars (shorter performs better)
- Strategy: Complete message above fold

**LinkedIn:**
- Max: 3,000 characters
- Optimal: 150-250 chars (professional brevity)
- Strategy: Value-first, context after

**TikTok:**
- Max: 2,200 characters
- Optimal: 100-150 chars (fast-scrolling behavior)
- Strategy: Immediate hook, minimal text

---

## 2. VISUAL DIRECTION SPECIFICATION

### Photo Direction

**Template:**
```
Subject: [Specific dish/scene]
Angle: [Camera position and perspective]
Setting: [Environment and context]
Lighting: [Natural/artificial, tone, quality]
Styling: [Colors, props, composition]
Optional Elements: [Supporting items]
Technical: [Dimensions, format]
```

**Example (Menu Highlight - Spring Salmon):**
```
Subject: Pan-seared salmon with spring asparagus
Angle: 45-degree angle, shows full plate composition
Setting: White ceramic plate on terrace table, harbor water view with soft background blur
Lighting: Natural daylight, warm tones, late afternoon sun (3-4pm)
Styling: Fresh, bright spring colors prominent - green asparagus, pink salmon, light sauce
Optional: Glass of white wine in background, fresh herbs as garnish
Technical: 1080x1080 square for Instagram feed, RGB color space
Alt Text: "Pan-seared salmon fillet with bright green asparagus spears on white plate, harbor view visible in soft focus background"
```

### Carousel Direction

**Template:**
```
Format: [Number] slides
Slide 1: [Hero/primary image]
Slide 2: [Supporting detail]
Slide 3: [Context/story]
Slide 4+: [Additional angles]
Technical: [Dimensions per slide]
```

**Example (Event Promotion - Spring Menu Launch):**
```
Format: 4 slides
Slide 1: Hero dish close-up - main spring special
Slide 2: Ingredient sourcing - asparagus at local Danish market
Slide 3: Chef plating the dish in kitchen
Slide 4: Final presentation on terrace with location in background
Technical: All slides 1080x1080 square, consistent color grading
Alt Text (Slide 1): "Close-up of spring salmon dish with vibrant green asparagus and lemon beurre blanc sauce"
```

### Reel/Video Direction

**Template:**
```
Duration: [Total seconds]
Scene 1: [Action + duration]
Scene 2: [Action + duration]
Scene 3: [Action + duration]
Transitions: [Style between scenes]
Audio: [Music + natural sounds]
Text Overlays: [If needed]
Technical: [Resolution, format]
```

**Example (Behind-Scenes - Salmon Preparation):**
```
Duration: 15 seconds
Scene 1 (0-3s): Chef searing salmon in hot pan, flames visible, dynamic angle
Scene 2 (3-6s): Close-up of plating - asparagus being arranged with tweezers
Scene 3 (6-10s): Sauce drizzle in slow motion
Scene 4 (10-15s): Final dish being carried to terrace table, harbor in background
Transitions: Quick cuts, match on action
Audio: Natural cooking sounds (sizzle, plating), light background music (upbeat, 80-100 BPM)
Text Overlays: "Spring on a plate" (0-2s), "Fresh daily" (10-12s)
Technical: 1080x1920 vertical (9:16), 30fps, H.264 codec
Alt Text: "Video showing chef preparing pan-seared salmon dish, from cooking to plating to serving on waterfront terrace"
```

### Technical Specifications

**Instagram:**
- Feed Photo: 1080x1080 (square) or 1080x1350 (portrait)
- Stories: 1080x1920 (9:16)
- Reels: 1080x1920 (9:16), 15-90 seconds, max 30s for feed

**Facebook:**
- Photo: 1200x630 (landscape) or 1080x1080 (square)
- Video: 1080x1080 (square) or 1920x1080 (landscape), up to 240 minutes

**LinkedIn:**
- Photo: 1200x627 (landscape) or 1080x1080 (square)
- Video: 1920x1080 (landscape), 3 seconds to 10 minutes

**TikTok:**
- Video: 1080x1920 (9:16), 15-60 seconds optimal
- Photo mode: 1080x1920 (9:16)

---

## 3. OUTPUT STRUCTURE

### ContentCreationBrief Interface

```typescript
interface ContentCreationBrief {
  // Caption
  caption: string                    // Platform-optimized text
  firstLine: string                  // First 125 chars (truncation preview)
  characterCount: number             // Validation against platform limit
  
  // Visual Direction
  visualDirection: {
    format: 'photo' | 'carousel' | 'reel' | 'video'
    subject: string
    directions: string[]             // Detailed instructions
    sceneBreakdown?: {               // For video/reel
      scene: number
      duration: string
      action: string
    }[]
  }
  
  // Technical Specs
  technicalSpecs: {
    dimensions: string               // e.g., "1080x1080"
    aspectRatio: string              // e.g., "1:1", "9:16"
    duration?: string                // For video: "15s", "30s"
    fileFormat: string               // "JPG", "MP4", etc.
    colorSpace: string               // "RGB"
    videoCodec?: string              // "H.264"
    frameRate?: string               // "30fps"
  }
  
  // Accessibility
  altText: string                    // Image description for screen readers
  
  // Scheduling Context
  schedulingInfo: {
    day: string                      // "Monday", "Wednesday"
    time: string                     // "14:30"
    platform: string                 // "instagram", "facebook"
    timeRationale: string            // "Lunch hour peak engagement"
  }
  
  // Context Notes
  contextNotes: string               // Why this content now (season, weather, location)
  
  // Metadata
  contentType: string                // "menu_highlight", "behind_scenes"
  businessType: string               // "FSE", "MFV"
  creationEstimate: string           // "5 minutes", "20 minutes"
}
```

---

## 4. GENERATION LOGIC

### Caption Generation Algorithm

```
1. Load brand voice from Layer 1 (casual/refined/playful/professional)
2. Get seasonal context from Layer 3 (season, weather, location)
3. Determine content type purpose (menu/engagement/storytelling)

4. Generate hook (125 chars max):
   - Casual: Question or relatable statement
   - Refined: Elegant statement
   - Playful: Wordplay or humor
   - Professional: Clear value proposition

5. Build core message:
   - What: Specific dish/subject
   - Why: Relevance (seasonal, local, special)

6. Weave context:
   - Season reference (spring freshness, winter warmth)
   - Weather tie-in (sunny terrace, cozy interior)
   - Location amplifier (waterfront views, historic charm)

7. Add CTA:
   - Menu posts: Booking/visit CTA
   - Engagement: Question/tag CTA
   - Story posts: Follow/discover CTA

8. Apply emojis based on voice frequency rules

9. Validate platform character limit

10. Generate first-line preview (truncation check)
```

### Visual Direction Algorithm

```
1. Determine format from Layer 7 (photo/carousel/reel)

2. IF photo:
   - Specify subject, angle, setting
   - Define lighting (time of day → natural light quality)
   - Style with seasonal context (spring = bright, winter = warm)
   - Add optional elements (drinks, props)
   
3. IF carousel:
   - Slide 1: Hero/main dish
   - Slide 2-3: Story elements (sourcing, prep, context)
   - Slide 4: Location/atmosphere
   
4. IF reel:
   - Break into 3-5 scenes (2-5 seconds each)
   - Scene 1: Action shot (cooking, prep)
   - Scene 2: Detail (plating, close-up)
   - Scene 3: Context (serving, location)
   - Add audio direction
   - Add text overlay timing

5. Apply technical specs from platform

6. Generate alt text (accessibility)
   - Describe visual elements
   - Include key subjects
   - Note important context (location, setting)
```

---

## 5. QUALITY CHECKS

### Caption Quality Validation
- ✅ First line hooks attention (under 125 chars)
- ✅ Brand voice consistency
- ✅ Context weaving present (season/weather/location)
- ✅ CTA appropriate for content type
- ✅ Platform character limit respected
- ✅ Emoji frequency matches brand voice
- ✅ Readability score appropriate

### Visual Direction Quality Validation
- ✅ Format matches Layer 7 selection
- ✅ Directions are actionable (not vague)
- ✅ Technical specs match platform requirements
- ✅ Scene timing adds to proper video length
- ✅ Alt text describes key visual elements
- ✅ Lighting/styling matches time of day
- ✅ Seasonal context reflected in visual direction

---

## 6. INTEGRATION POINTS

**Input Dependencies:**
- Layer 1: Brand voice, tone modifiers
- Layer 3: Season, weather, location amplifiers
- Layer 5: Content subject (menu items, themes)
- Layer 6: Day/time scheduling
- Layer 7: Format and platform selection

**Output Usage:**
- Content creators receive actionable briefs
- Photographers/videographers get technical specs
- Social media managers get caption + scheduling
- Accessibility team gets alt text
- Performance tracking gets creation time estimates

---

## STATUS: Ready for Implementation ✅

Next steps:
1. Create caption-generator.ts
2. Create visual-direction-generator.ts
3. Create content-brief-assembler.ts
4. Create comprehensive test suite
5. Integrate with Layers 1-7
