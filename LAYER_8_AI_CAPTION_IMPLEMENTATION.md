# Layer 8: AI-Driven Caption Generation Implementation Plan

## 🎯 Objective
Replace template-based caption generation with **Gemini 2.0 Flash** AI-driven caption generation.

---

## 📊 Current State Analysis

### ❌ **Problem: Template-Based Implementation**
File: `supabase/functions/_shared/post-helpers/caption-generator.ts`

**Current approach:**
```typescript
// Hardcoded templates
const hook = generateHook(brandVoice, contentPurpose.type, contentPurpose.subject)
const coreMessage = generateCoreMessage(brandVoice, contentPurpose.subject, contentPurpose.type)
const contextEnrichment = weaveContext(seasonalContext, locationContext, contentPurpose.postTime)
const cta = generateCTA(brandVoice, contentPurpose.type)

// Assembles: "hook + coreMessage + context + CTA"
// Result: Repetitive, robotic captions
```

**Issues:**
- ❌ String concatenation of predefined templates
- ❌ Limited variation and creativity
- ❌ Cannot adapt to unique business contexts
- ❌ Feels robotic and repetitive
- ❌ Violates Layer 8 architectural principle (should be AI-driven)

---

## ✅ **Solution: Gemini Flash AI Generation**

### Architecture: Layers 1-7 → Layer 8 (AI) → Layer 9

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 8: AI-DRIVEN CAPTION GENERATION (Gemini 2.0 Flash)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INPUT CONTEXT (from Layers 1-7):                          │
│  ├─ Layer 1: Menu items, business info                     │
│  ├─ Layer 2: Category defaults, audience                   │
│  ├─ Layer 3: Seasonal context, events, weather            │
│  ├─ Layer 5: Content opportunities (what to post about)    │
│  ├─ Layer 6: Optimal posting time (day/hour)              │
│  ├─ Layer 7: Format (photo/carousel/reel) + Platform      │
│  └─ Brand Profile: tone_keywords, voice_style, values     │
│                                                             │
│  AI PROCESSING (Gemini Flash):                             │
│  ├─ Build comprehensive prompt with all context            │
│  ├─ Call Gemini API with structured JSON output           │
│  ├─ Generate natural, contextual caption                   │
│  ├─ Select platform-appropriate emojis                     │
│  ├─ Generate smart hashtags (trending + niche + branded)  │
│  └─ Validate against brand restrictions (do_not_say)      │
│                                                             │
│  OUTPUT (to Layer 9):                                      │
│  ├─ caption: Natural language text (125-400 chars)         │
│  ├─ hashtags: 8-12 hashtags (40% trending, 30% niche,     │
│  │             30% branded)                                │
│  ├─ emojis: Platform-appropriate (Instagram: 2-4,         │
│  │           Facebook: 1-2)                                │
│  └─ metadata: Tone, style, content safety validation      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Plan

### **Phase 1: Create AI Caption Generator (New File)**

**File:** `supabase/functions/_shared/ai-caption-generator/index.ts`

**Key Components:**

1. **Prompt Builder** - Assembles context from all layers
2. **Gemini API Caller** - Calls Gemini with structured prompt
3. **Response Parser** - Extracts caption, hashtags, emojis
4. **Content Safety Validator** - Checks against `do_not_say` restrictions
5. **Platform Optimizer** - Ensures character limits and emoji counts

### **Phase 2: Define Input/Output Types**

```typescript
// Input: All context from Layers 1-7
interface CaptionGenerationContext {
  // From Layer 1: Business info
  businessName: string
  businessCategory: string
  country: string
  
  // From Brand Profile (business_brand_profile table)
  brandVoice: {
    tone_keywords?: string[]      // ["hyggelig", "uformel", "lokal"]
    voice_style?: string           // "du-form, emojis ok"
    values?: string[]              // ["økologisk", "bæredygtig"]
    certifications?: string[]      // ["Ø-mærket", "Fairtrade"]
    do_not_say?: {                 // Content restrictions
      words: string[]
    }
  }
  
  // From Layer 5: Content opportunity
  contentOpportunity: {
    type: 'menu_highlight' | 'behind_scenes' | 'atmosphere' | 'engagement' | 'event_promotion'
    subject: string                 // "Danish Winter Stew" or "Friday Night Energy"
    menuItem?: {
      name: string
      description?: string
      category?: string
      score?: number                // From menu scoring
    }
  }
  
  // From Layer 3: Temporal context
  temporalContext: {
    season: 'spring' | 'summer' | 'fall' | 'winter'
    dayOfWeek: string              // "Friday"
    timeOfDay: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
    upcomingEvents?: string[]      // From contextual_calendar
    weather?: string               // "Rainy" or "Sunny"
  }
  
  // From Layer 6: Optimal timing
  postingTime: {
    hour: number                   // 18 (6 PM)
    dayPart: string                // "evening"
  }
  
  // From Layer 7: Format & Platform
  format: 'photo' | 'carousel' | 'reel'
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
  
  // Optional: Previous performance data (Layer 4)
  performanceContext?: {
    topPerformingContentTypes: string[]
    avgEngagementRate: number
  }
}

// Output: AI-generated caption with all components
interface GeneratedCaption {
  caption: string                  // Natural language caption (125-400 chars)
  hashtags: string[]               // 8-12 hashtags
  emojis: string[]                 // Platform-appropriate emojis
  
  metadata: {
    characterCount: number
    platform: string
    tone: string                   // AI's interpretation of applied tone
    contentSafetyPassed: boolean   // Passed do_not_say validation
    warningFlags?: string[]        // Any content concerns
  }
  
  structure?: {                    // For debugging/learning
    hook: string
    mainMessage: string
    cta: string
  }
}
```

### **Phase 3: Build Prompt System**

**Prompt Structure:**

```typescript
function buildCaptionPrompt(context: CaptionGenerationContext): string {
  return `You are a Danish social media copywriter specializing in ${context.businessCategory} businesses.

BUSINESS CONTEXT:
- Name: ${context.businessName}
- Category: ${context.businessCategory}
- Country: ${context.country}
${context.brandVoice.values ? `- Values: ${context.brandVoice.values.join(', ')}` : ''}
${context.brandVoice.certifications ? `- Certifications: ${context.brandVoice.certifications.join(', ')}` : ''}

BRAND VOICE:
${context.brandVoice.tone_keywords ? `- Tone: ${context.brandVoice.tone_keywords.join(', ')}` : ''}
${context.brandVoice.voice_style ? `- Style: ${context.brandVoice.voice_style}` : ''}

CONTENT TO PROMOTE:
- Type: ${context.contentOpportunity.type}
- Subject: ${context.contentOpportunity.subject}
${context.contentOpportunity.menuItem?.description ? `- Description: ${context.contentOpportunity.menuItem.description}` : ''}

TIMING & CONTEXT:
- Season: ${context.temporalContext.season}
- Day: ${context.temporalContext.dayOfWeek}
- Time: ${context.temporalContext.timeOfDay}
${context.temporalContext.weather ? `- Weather: ${context.temporalContext.weather}` : ''}
${context.temporalContext.upcomingEvents?.length ? `- Upcoming Events: ${context.temporalContext.upcomingEvents.join(', ')}` : ''}

PLATFORM REQUIREMENTS:
- Platform: ${context.platform}
- Format: ${context.format}
${getPlatformGuidelines(context.platform)}

${context.brandVoice.do_not_say?.words?.length ? `
CONTENT RESTRICTIONS (DO NOT USE):
${context.brandVoice.do_not_say.words.map(word => `- "${word}"`).join('\n')}
` : ''}

TASK:
Create a ${context.platform} caption for a ${context.format} post about "${context.contentOpportunity.subject}".

REQUIREMENTS:
1. Write in Danish (naturally, not translated)
2. Match the brand's tone: ${context.brandVoice.tone_keywords?.join(', ') || 'casual and friendly'}
3. Be conversational and authentic (NOT robotic or template-like)
4. ${getEmojiGuideline(context.platform)}
5. Character limit: ${getCharacterLimit(context.platform)} (optimal: ${getOptimalLength(context.platform)})
6. Include a clear but natural call-to-action
7. Weave in seasonal/timing context naturally (${context.temporalContext.season}, ${context.temporalContext.dayOfWeek} ${context.temporalContext.timeOfDay})

HASHTAG STRATEGY:
- Total: 8-12 hashtags
- Mix: 40% trending (Danish/local events), 30% niche (content-specific), 30% branded (business name, location)
- Examples: #CopenhagenEats #Hygge #${context.businessName.replace(/\s+/g, '')}

Return ONLY valid JSON:
{
  "caption": "Natural Danish language caption here...",
  "hashtags": ["#hashtag1", "#hashtag2", ...],
  "emojis": ["🍽️", "✨"],
  "tone_applied": "hyggelig, uformel",
  "hook": "First sentence/phrase",
  "main_message": "Core content message",
  "cta": "Call to action phrase"
}`
}

function getPlatformGuidelines(platform: string): string {
  const guidelines = {
    instagram: `
- Character limit: 2200 (optimal: 125-150 for first line visibility)
- Emoji frequency: 2-4 emojis encouraged
- Hashtag placement: End of caption or first comment
- Tone: Casual, visual storytelling`,
    
    facebook: `
- Character limit: 63,206 (optimal: 200-400)
- Emoji frequency: 1-2 emojis (moderate)
- Hashtag usage: Less important than Instagram (use 3-5)
- Tone: Conversational, community-focused`,
    
    linkedin: `
- Character limit: 3000 (optimal: 150-250)
- Emoji frequency: 0-1 (professional setting)
- Hashtag usage: 3-5 relevant professional hashtags
- Tone: Professional but approachable`,
    
    tiktok: `
- Character limit: 2200 (optimal: 100-150)
- Emoji frequency: 3-5 (trending emojis)
- Hashtag usage: 5-8 trending hashtags crucial
- Tone: Playful, energetic, trend-aware`
  }
  
  return guidelines[platform] || guidelines.instagram
}
```

---

## 📁 File Structure

```
supabase/functions/_shared/
├── gemini-client.ts              # ✅ Already exists (reuse)
└── ai-caption-generator/
    ├── index.ts                  # Main export
    ├── types.ts                  # TypeScript interfaces
    ├── prompt-builder.ts         # Build AI prompts from context
    ├── gemini-caller.ts          # Call Gemini API
    ├── response-parser.ts        # Parse Gemini JSON response
    ├── content-safety.ts         # Validate against do_not_say
    └── platform-optimizer.ts     # Ensure platform-specific requirements
```

---

## 🔄 Integration with Existing System

### **Where to Call AI Caption Generator:**

1. **Weekly Plan Generation** (Layer 9)
   - File: Where weekly content plans are assembled
   - Import: `import { generateAICaption } from '../_shared/ai-caption-generator'`

2. **Individual Post Creation** (UI flow)
   - When user generates a post idea
   - Call AI caption generator with full context

3. **Batch Post Generation** (Automation)
   - Generate captions for entire weekly plan
   - Parallel processing with rate limiting

### **Data Flow:**

```typescript
// Example usage in weekly plan generation:
import { generateAICaption } from '../_shared/ai-caption-generator'

async function generateWeeklyPlan(businessId: string) {
  // 1. Gather context from Layers 1-7
  const businessInfo = await getBusinessInfo(businessId)
  const brandProfile = await getBrandProfile(businessId)
  const contentOpportunities = await getContentOpportunities(businessId)
  const temporalContext = await getTemporalContext(date)
  const platformSettings = await getPlatformSettings(businessId)
  
  // 2. For each content opportunity, generate AI caption
  const posts = await Promise.all(
    contentOpportunities.map(async (opportunity) => {
      const context: CaptionGenerationContext = {
        businessName: businessInfo.name,
        businessCategory: businessInfo.category,
        country: businessInfo.country,
        brandVoice: brandProfile,
        contentOpportunity: opportunity,
        temporalContext: temporalContext,
        postingTime: opportunity.optimalTime,
        format: opportunity.format,
        platform: platformSettings.primary_platform,
      }
      
      // 3. Call AI caption generator
      const caption = await generateAICaption(context)
      
      return {
        ...opportunity,
        caption: caption.caption,
        hashtags: caption.hashtags,
        emojis: caption.emojis,
        metadata: caption.metadata,
      }
    })
  )
  
  return posts
}
```

---

## 🧪 Testing Strategy

### **1. Unit Tests**
- Test prompt builder with various contexts
- Test response parser with mock Gemini responses
- Test content safety validator with banned words
- Test platform optimizer (character limits, emoji counts)

### **2. Integration Tests**
- Test full flow with real Gemini API calls
- Test different business categories (cafe, restaurant, bakery)
- Test different platforms (Instagram, Facebook)
- Test different content types (menu, atmosphere, engagement)

### **3. Quality Validation**
- Compare AI-generated captions vs template-based
- Measure: Uniqueness, creativity, brand voice consistency
- User feedback: A/B test AI vs templates

---

## 📊 Success Metrics

### **Technical:**
- ✅ AI API calls successful (99%+ success rate)
- ✅ Response time < 3 seconds per caption
- ✅ Content safety validation passes
- ✅ Platform requirements met (character limits, emoji counts)

### **Quality:**
- ✅ Unique captions (no repetition across posts)
- ✅ Natural language (not robotic)
- ✅ Brand voice consistency (matches tone_keywords)
- ✅ Contextually appropriate (uses season, timing, events)

### **User Satisfaction:**
- ✅ Users prefer AI captions over templates (A/B test)
- ✅ Reduced manual editing required
- ✅ Higher engagement rates on posts with AI captions

---

## 🚀 Implementation Steps

### **Step 1: Create Core AI Caption Generator** (2-3 hours)
- [x] Review existing Gemini client
- [ ] Create `ai-caption-generator/` directory structure
- [ ] Define TypeScript types
- [ ] Build prompt builder
- [ ] Implement Gemini caller
- [ ] Create response parser
- [ ] Add content safety validator

### **Step 2: Test with Real Data** (1-2 hours)
- [ ] Test with Café Faust data (840347de-9ba7-4275-8aa3-4553417fc2af)
- [ ] Generate 5-10 sample captions
- [ ] Validate quality, tone, platform requirements
- [ ] Iterate on prompt engineering

### **Step 3: Replace Template System** (1 hour)
- [ ] Update weekly plan generation to use AI captions
- [ ] Update individual post generation to use AI captions
- [ ] Add fallback to templates (if AI fails)
- [ ] Update error handling

### **Step 4: Create Layer 9 Test** (1 hour)
- [ ] Create `TEST_LAYER_9_DATABASE.sql`
- [ ] Verify Layer 8 → Layer 9 data flow
- [ ] Test complete weekly plan assembly
- [ ] Validate final output format

---

## 💡 Prompt Engineering Tips

### **For Natural Captions:**
- Use "Write naturally in Danish" not "Translate to Danish"
- Provide brand voice examples (if available)
- Specify "conversational, not robotic"
- Give seasonal/timing context for natural weaving

### **For Consistency:**
- Use exact tone_keywords from brand profile
- Reference voice_style (du-form, emojis ok, etc.)
- Include brand values as context
- Pass previous high-performing captions (optional)

### **For Platform Optimization:**
- Specify character limits clearly
- State emoji guidelines explicitly
- Explain hashtag strategy (trending + niche + branded)
- Provide platform-specific examples

---

## 🔧 Configuration

### **Environment Variables:**
Already set up in Supabase:
- `GEMINI_API_KEY` ✅ (existing)

### **Model Settings:**
```typescript
const GEMINI_CONFIG = {
  model: 'gemini-2.0-flash-exp',
  temperature: 0.7,              // Higher for creativity
  maxOutputTokens: 1024,         // Captions are short
  responseMimeType: 'application/json'
}
```

---

## 📖 Example Output

### **Input Context:**
```json
{
  "businessName": "Café Faust",
  "businessCategory": "café",
  "country": "DK",
  "brandVoice": {
    "tone_keywords": ["hyggelig", "uformel", "lokal"],
    "voice_style": "du-form, emojis ok"
  },
  "contentOpportunity": {
    "type": "menu_highlight",
    "subject": "Danish Winter Stew",
    "menuItem": {
      "description": "Slow-cooked beef stew with root vegetables"
    }
  },
  "temporalContext": {
    "season": "winter",
    "dayOfWeek": "Friday",
    "timeOfDay": "evening",
    "weather": "Cold"
  },
  "platform": "instagram",
  "format": "photo"
}
```

### **AI-Generated Output (Gemini Flash):**
```json
{
  "caption": "Fredag aften krydret med varmende vintermad 🥘 Vores langtidsstuvede oksegryde med rodfrugter bringer hygge til bordet - perfekt til en kølig københavnsk aften ✨",
  "hashtags": [
    "#CopenhagenEats",
    "#Vintermad",
    "#Hygge",
    "#LokalMad",
    "#FreskFood",
    "#Oksegryde",
    "#DanskMad",
    "#CaféFaust",
    "#Nørrebro",
    "#SlowFood",
    "#VinterHygge"
  ],
  "emojis": ["🥘", "✨"],
  "tone_applied": "hyggelig, uformel, lokal",
  "hook": "Fredag aften krydret med varmende vintermad",
  "main_message": "Vores langtidsstuvede oksegryde med rodfrugter bringer hygge til bordet",
  "cta": "perfekt til en kølig københavnsk aften"
}
```

**Translation:**
> "Friday evening spiced with warming winter food 🥘 Our slow-cooked beef stew with root vegetables brings hygge to the table - perfect for a chilly Copenhagen evening ✨"

**Quality indicators:**
- ✅ Natural Danish (not translated)
- ✅ Matches brand tone (hyggelig, uformel)
- ✅ Weaves context (Friday evening, winter, cold weather)
- ✅ Platform-appropriate (125 chars, 2 emojis)
- ✅ Smart hashtags (trending + niche + branded)
- ✅ Conversational, not robotic

---

## ⚠️ Important Notes

1. **Gemini Flash vs OpenAI:**
   - Gemini 2.0 Flash: Faster, cheaper, good for structured output
   - Already integrated in codebase
   - Use existing `gemini-client.ts` helper

2. **Rate Limiting:**
   - Implement retry logic (already in gemini-client)
   - Consider batch processing for weekly plans
   - Cache generated captions (optional)

3. **Fallback Strategy:**
   - Keep template system as fallback (if AI fails)
   - Log AI failures for monitoring
   - Graceful degradation to templates

4. **Cost Estimation:**
   - Gemini Flash: ~$0.075 per 1M input tokens
   - Average caption prompt: ~800 tokens
   - 100 captions = ~$0.006 (very affordable)

5. **Language Support:**
   - Currently focused on Danish
   - Easy to extend to other languages by updating prompts

---

## 🎯 Next Steps

1. **Review this plan** ✅ (you are here)
2. **Implement AI caption generator** (start with prompt builder)
3. **Test with real business data** (Café Faust)
4. **Iterate on prompt engineering** (improve quality)
5. **Replace template system** (integrate with weekly plans)
6. **Create Layer 9 test** (validate complete flow)
7. **Deploy to production** (monitor performance)

---

## 📚 References

- Existing Gemini client: `supabase/functions/_shared/gemini-client.ts`
- Current template system: `supabase/functions/_shared/post-helpers/caption-generator.ts`
- Brand profile schema: `business_brand_profile` table
- AI configuration: `src/config/ai-models.ts`

---

**Status:** 📋 PLANNING COMPLETE - READY FOR IMPLEMENTATION

Would you like me to proceed with implementing the AI caption generator?
