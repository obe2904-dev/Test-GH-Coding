# Brand Profile → AI Ideas Mapping

Complete data flow from Business Profile fields to AI-generated post ideas.

---

## 📊 Business Profile Fields

### **1. business_name** `string` (Required)
**Database**: `businesses.name`  
**Used In**: Prompt context, hashtag generation  
**Effect on AI**:
- Included in prompt as "Business Name: {name}"
- Used for branded hashtags (#BusinessName)
- Provides business identity context for AI

**Code Path**:
```
businesses.name 
  → BusinessProfile.business_name
  → formatBusinessProfileForPrompt() → "Business Name: {name}"
  → buildUserPrompt() → OpenAI
  → generateHashtags() → ["#BusinessName", ...]
```

---

### **2. primary_language** `string` (Required)
**Database**: `businesses.primary_language`  
**Used In**: System prompt, locale config, language validation  
**Effect on AI**:
- Determines which locale config to use (da/Danish, en/English, etc.)
- Sets cultural norms (hygge, formality level, emoji usage)
- Configures language-specific grammar rules
- Validates output language compliance

**Code Path**:
```
businesses.primary_language 
  → BusinessProfile.primary_language
  → buildSystemPrompt(language) → "Generate content in {language}"
  → getLocaleConfig(language) → Cultural norms + CTA templates
  → validateLanguageCompliance() → Check output
```

**Locale Features** (policies/locale-config.ts):
- **Danish**: Hygge emphasis, informal "du", avoid Americanisms
- **English**: International, flexible tone
- **Swedish**: "Lagom" concept, soft approach
- **Norwegian**: "Koselig" atmosphere
- **German**: Formal/informal distinction

---

### **3. country** `string` (Optional)
**Database**: `business_locations.country` (is_primary=true)  
**Used In**: Locale config, cultural context, menu validation  
**Effect on AI**:
- Refines locale-specific cultural norms
- Adjusts meal period definitions (Danish lunch 11:30-14:30)
- Influences seasonal references and local holidays
- Used in menu daypart validation

**Code Path**:
```
business_locations.country 
  → BusinessProfile.country
  → getLocaleConfig(language, country) → Country-specific norms
  → getMenuCategoryGuidance() → Daypart definitions
  → buildUserPrompt() → Location context
```

---

### **4. city** `string` (Optional)
**Database**: `business_locations.city` (is_primary=true)  
**Used In**: Prompt context only  
**Effect on AI**:
- Provides location context for local references
- Enables city-specific cultural mentions
- Example: "København" → AI can reference city landmarks/neighborhoods

**Code Path**:
```
business_locations.city 
  → BusinessProfile.city
  → formatBusinessProfileForPrompt() → "Location: {city}, {country}"
  → buildUserPrompt() → OpenAI
```

---

### **5. brand_voice** `object` (Optional)
**Database**: `business_brand_profile` (joined)  
**Structure**:
```typescript
brand_voice: {
  tone?: string[]          // ['venlig', 'professionel', 'hyggelig']
  essence?: string         // 'Modern skandinavisk elegance med varme'
  style_notes?: string     // 'Underspillet humor, fokus på håndværk'
}
```

**Used In**: Prompt as explicit instructions  
**Effect on AI**:
- **Critical influence** on writing style
- AI matches tone keywords in every suggestion
- Essence guides overall brand personality
- Style notes provide nuanced direction

**Code Path**:
```
business_brand_profile.tone_keywords → brand_voice.tone
business_brand_profile.voice_style → brand_voice.essence
business_brand_profile.values → brand_voice.style_notes
  → formatBusinessProfileForPrompt() → "=== BRAND VOICE ==="
  → buildSystemPrompt() → "Match the brand voice and tone exactly"
  → AI generation → Ideas reflect brand personality
```

**Example Prompt Section**:
```
=== BRAND VOICE ===
Essence: Modern skandinavisk elegance med varme
Tone: venlig, professionel, hyggelig
Style: Underspillet humor, fokus på håndværk
```

---

### **6. business_offerings** `string` (Optional)
**Database**: `business_profile.short_description`  
**Used In**: Prompt context  
**Effect on AI**:
- Provides factual information about what business offers
- Prevents AI from inventing offerings not mentioned
- Guides content focus (e.g., "organic ingredients" → health-focused posts)

**Code Path**:
```
business_profile.short_description 
  → BusinessProfile.business_offerings
  → formatBusinessProfileForPrompt() → "=== OFFERINGS ==="
  → buildUserPrompt() → OpenAI
```

**Example**:
```
=== OFFERINGS ===
Vi serverer autentisk italiensk køkken med økologiske råvarer. 
Specialitet: hjemmelavet pasta og sæsonmenuer.
```

---

### **7. content_pillars** `string[]` (Optional)
**Database**: `business_brand_profile.values`  
**Used In**: Prompt as thematic guidance  
**Effect on AI**:
- Defines key themes for content variety
- AI creates posts aligned with each pillar
- Ensures strategic consistency across posts

**Code Path**:
```
business_brand_profile.values 
  → BusinessProfile.content_pillars
  → formatBusinessProfileForPrompt() → "=== CONTENT PILLARS ==="
  → buildUserPrompt() → OpenAI
```

**Example**:
```
=== CONTENT PILLARS ===
Bæredygtighed
Håndværk og kvalitet
Fællesskab og samvær
Sæsonbevidsthed
```

**Effect**: AI will create posts touching these themes (e.g., vibe post about sustainability, moment post about seasonal ingredients)

---

### **8. booking_url** `string` (Optional)
**Database**: `businesses.website_url`  
**Used In**: Response formatter (NOT in prompt)  
**Effect on AI**: None (handled after AI generation)  

**Code Path**:
```
businesses.website_url 
  → BusinessProfile.booking_url
  → [AI generates PostIdea with cta_intent='book']
  → formatForFacebook() → cta.url = booking_url (if intent is 'book'/'visit')
  → formatForInstagram() → cta.url = undefined (always)
```

**Platform Logic**:
- **Facebook**: Includes clickable URL when `cta_intent = 'book' | 'visit'`
- **Instagram**: Never includes URL (uses "Book via link i bio")

---

### **9. forbidden_terms** `string[]` (Optional)
**Database**: `business_brand_profile.do_not_say.words`  
**Used In**: Prompt instructions + post-generation validation  
**Effect on AI**:
- Explicitly tells AI to avoid certain words/phrases
- Validator rejects ideas containing forbidden terms
- Ensures brand compliance

**Code Path**:
```
business_brand_profile.do_not_say.words 
  → BusinessProfile.forbidden_terms
  → formatBusinessProfileForPrompt() → "=== FORBIDDEN TERMS ==="
  → buildSystemPrompt() → "Never use forbidden terms"
  → validatePostIdea() → Checks caption_base + hook for violations
```

**Example**:
```
=== FORBIDDEN TERMS ===
Never use: billig, hurtig, fastfood, discount
```

**Validation** (validators/content-validator.ts line 86):
```typescript
for (const term of businessProfile.forbidden_terms) {
  if (captionLower.includes(termLower) || hookLower.includes(termLower)) {
    errors.push({ message: `Contains forbidden term: "${term}"`, severity: 'error' })
  }
}
```

---

### **10. required_tone_anchors** `string[]` (Optional)
**Database**: Not currently populated (placeholder)  
**Used In**: Prompt instructions  
**Effect on AI**:
- Requires AI to include specific phrases
- Enforces brand-specific language patterns
- Example: "Must include at least one: 'smagsoplevelse', 'håndværk', 'nyd i godt selskab'"

**Code Path**:
```
BusinessProfile.required_tone_anchors
  → formatBusinessProfileForPrompt() → "=== REQUIRED PHRASES ==="
  → buildUserPrompt() → OpenAI
```

**Status**: Field exists but not currently enforced in validation. Future enhancement.

---

### **11. cta_config** `object` (Optional)
**Database**: Not yet in database (code-ready, schema pending)  
**Structure**:
```typescript
cta_config: {
  default_style?: 'soft' | 'booking'
  custom_ctas?: {
    book?: string      // "Book dit bord nu"
    visit?: string     // "Kom forbi i dag"
    menu?: string      // "Se vores menu"
    engage?: string    // "Tag os med"
  }
  use_emojis?: boolean
}
```

**Used In**: Response formatter (NOT in prompt)  
**Effect on AI**: None (AI generates `cta_intent`, formatter selects CTA)

**Code Path**:
```
BusinessProfile.cta_config
  → [AI generates PostIdea with cta_intent='book']
  → selectCTAText() → Priority order:
    1. custom_ctas.book (if exists) → "Book dit bord nu"
    2. default_style → 'soft' → use visit CTA | 'booking' → use booking CTA
    3. Platform templates → "📅 Book bord nu" (Facebook) or "Book via link i bio" (Instagram)
```

**Priority System** (response-formatter.ts line 127):
1. **Custom CTAs** → Business-specific text (highest priority)
2. **Default Style** → Soft vs. direct preference
3. **Platform Templates** → Locale-aware defaults from platform-rules.ts

---

## 🔄 Complete Data Flow

### **Generation Phase**

```
1. FETCH BUSINESS PROFILE
   businesses table + joins
     ↓
   BusinessProfile object

2. BUILD CONTEXT
   - Business Profile → formatBusinessProfileForPrompt()
   - Menu Catalog → formatMenuForPrompt()
   - Weather → formatWeatherForPrompt()
   - Previous Posts → formatPreviousPostsForPrompt()
   - Generation Plan → formatPlanForPrompt() [strategy-engine.ts]
     ↓
   Full Context String

3. BUILD PROMPTS
   - System Prompt: buildSystemPrompt(language)
     • Locale config (cultural norms, formality, emoji usage)
     • Language-specific rules (Danish idioms, avoid Americanisms)
     • Critical instructions (no URLs, no hashtags in caption_base)
   
   - User Prompt: buildUserPrompt(context, plan)
     • Generation plan (pre-decided idea mix)
     • Business profile (name, voice, offerings, pillars)
     • Menu items (with category assignments)
     • Weather, season, time context
     • Previous posts for learning
     ↓
   OpenAI Request

4. AI GENERATION
   OpenAI generates JSON:
   {
     "ideas": [
       {
         "idea_type": "menu",
         "menu_item": {"name": "Eggs Benedict", "category": "BRUNCH"},
         "hook": "Søndagsbrunch i hjertet af København",
         "caption_base": "Start weekenden med vores klassiske Eggs Benedict...",
         "cta_intent": "book",
         "best_time": "11:00",
         "impact": "high",
         "photo_suggestion": "Close-up of perfectly poached eggs..."
       }
     ]
   }
     ↓
   PostIdea[] (platform-neutral)

5. VALIDATION
   validatePostIdea(idea, businessProfile, menuCatalog)
     • Check forbidden terms
     • Verify menu item exists in catalog
     • Validate daypart match (policy-based)
     • Check caption length (20-500 chars)
     ↓
   Validated PostIdeas

6. FORMATTING
   formatIdeasForPlatforms(ideas, businessProfile)
     ↓
   Facebook: formatForFacebook(idea, profile, locale)
     • Text: hook + caption_base (NO CTA)
     • CTA: {text, type, url} (URL if booking_url exists + intent='book')
     • Hashtags: 3-5 hashtags
   
   Instagram: formatForInstagram(idea, profile, locale)
     • Text: hook + caption_base (NO CTA)
     • CTA: {text: "Book via link i bio", type, url: undefined}
     • Hashtags: 8-15 hashtags
     ↓
   PlatformPost[] (platform-specific)

7. RETURN TO FRONTEND
   {
     raw_ideas: PostIdea[],
     facebook_posts: PlatformPost[],
     instagram_posts: PlatformPost[]
   }
```

---

## 📋 Field Usage Summary

| Field | In Prompt | In Validation | In Formatter | Effect Strength |
|-------|-----------|---------------|--------------|-----------------|
| `business_name` | ✅ | ❌ | ✅ (hashtags) | Medium |
| `primary_language` | ✅ | ✅ | ✅ | **Critical** |
| `country` | ✅ | ✅ | ✅ | Medium |
| `city` | ✅ | ❌ | ❌ | Low |
| `brand_voice` | ✅ | ❌ | ❌ | **Critical** |
| `business_offerings` | ✅ | ❌ | ❌ | Medium |
| `content_pillars` | ✅ | ❌ | ❌ | Medium |
| `booking_url` | ❌ | ❌ | ✅ | N/A (post-gen) |
| `forbidden_terms` | ✅ | ✅ | ❌ | **Critical** |
| `required_tone_anchors` | ✅ | ❌ (not impl.) | ❌ | Low (future) |
| `cta_config` | ❌ | ❌ | ✅ | Medium (post-gen) |

---

## 🎯 Key Insights

### **What AI Sees (In Prompt)**
1. **Business Identity**: name, language, location
2. **Brand Personality**: voice tone, essence, style notes
3. **Content Strategy**: offerings, content pillars
4. **Constraints**: forbidden terms, required phrases
5. **Context**: menu items, weather, season, previous posts
6. **Plan**: Pre-decided idea mix from strategy-engine

### **What AI Doesn't See (Handled by Code)**
1. **Platform Specifics**: Facebook vs Instagram formatting
2. **CTAs**: Selected after generation based on cta_config
3. **URLs**: Added by formatter for Facebook only
4. **Hashtags**: Generated separately based on platform rules
5. **Emoji Decisions**: Determined by cta_config.use_emojis

### **Critical Fields (Highest Impact)**
1. **brand_voice** → Directly shapes tone and style
2. **primary_language** → Determines locale and cultural approach
3. **forbidden_terms** → Hard constraint (validated post-generation)
4. **menu items** → Source material for menu-focused posts

### **Underutilized Fields**
1. **content_pillars** → Could be integrated into strategy engine
2. **required_tone_anchors** → Not validated (future feature)
3. **cta_config** → Not in database yet (code-ready)

---

## 🔍 Example: Complete Journey

**Input Profile**:
```typescript
{
  business_name: "Café Viggo",
  primary_language: "da",
  country: "Denmark",
  city: "København",
  brand_voice: {
    tone: ["venlig", "hyggelig", "autentisk"],
    essence: "Moderne skandinavisk café med hjerte",
    style_notes: "Underspillet humor, fokus på kvalitet"
  },
  business_offerings: "Økologisk kaffe, hjemmelavet brunch, sæsonkager",
  content_pillars: ["Bæredygtighed", "Håndværk", "Fællesskab"],
  booking_url: "https://booking.viggo.dk",
  forbidden_terms: ["billig", "hurtig"],
  cta_config: {
    default_style: "soft",
    use_emojis: true
  }
}
```

**Prompt (Simplified)**:
```
=== BUSINESS INFORMATION ===
Business Name: Café Viggo
Language: da
Location: København, Denmark

=== BRAND VOICE ===
Essence: Moderne skandinavisk café med hjerte
Tone: venlig, hyggelig, autentisk
Style: Underspillet humor, fokus på kvalitet

=== OFFERINGS ===
Økologisk kaffe, hjemmelavet brunch, sæsonkager

=== CONTENT PILLARS ===
Bæredygtighed
Håndværk
Fællesskab

=== FORBIDDEN TERMS ===
Never use: billig, hurtig

[+ menu items, weather, context...]
```

**AI Output (PostIdea)**:
```json
{
  "idea_type": "menu",
  "menu_item": {"name": "Eggs Benedict", "category": "BRUNCH"},
  "hook": "Søndagsbrunch i hjertet af København ☀️",
  "caption_base": "Start weekenden med vores klassiske Eggs Benedict. Lavet med økologiske æg fra Østerlars og hollandaise kogt fra bunden. Det er den slags håndværk, der tager tid – men smagen taler for sig selv.",
  "cta_intent": "book",
  "best_time": "10:30",
  "impact": "high",
  "photo_suggestion": "Close-up af perfekt pocherede æg på toast..."
}
```

**Formatter Output (Facebook)**:
```typescript
{
  platform: "facebook",
  text: "Søndagsbrunch i hjertet af København ☀️\n\nStart weekenden med vores klassiske Eggs Benedict. Lavet med økologiske æg fra Østerlars og hollandaise kogt fra bunden. Det er den slags håndværk, der tager tid – men smagen taler for sig selv.",
  cta: {
    text: "🍽️ Kom forbi",  // Soft CTA (default_style: "soft")
    type: "soft",
    url: "https://booking.viggo.dk"  // Added by formatter
  },
  hashtags: ["#CaféViggo", "#København", "#brunch"]
}
```

**Formatter Output (Instagram)**:
```typescript
{
  platform: "instagram",
  text: "Søndagsbrunch i hjertet af København ☀️\n\nStart weekenden med vores klassiske Eggs Benedict. Lavet med økologiske æg fra Østerlars og hollandaise kogt fra bunden. Det er den slags håndværk, der tager tid – men smagen taler for sig selv.",
  cta: {
    text: "Book via link i bio",  // Instagram soft CTA
    type: "soft",
    url: undefined  // Never URLs on Instagram
  },
  hashtags: ["#CaféViggo", "#København", "#brunch", "#eggsbenedict", "#søndagsbrunch", "#økologisk", "#håndværk", "#fællesskab", "#bæredygtigt"]
}
```

---

## 📊 Metrics: Field Impact

**Prompt Token Distribution** (approximate):
- System Prompt: 800 tokens (language rules, cultural norms)
- Business Profile: 200 tokens (name, voice, offerings, pillars)
- Menu Items: 400-800 tokens (depends on catalog size)
- Context: 200 tokens (weather, season, time)
- Strategy Plan: 300 tokens (pre-decided idea mix)
- Instructions: 400 tokens

**Total**: ~2,300-2,700 tokens per request

**Most Token-Heavy Fields**:
1. Menu catalog (400-800 tokens)
2. System prompt / Locale config (800 tokens)
3. Strategy plan (300 tokens)
4. Business profile (200 tokens)

---

## 🚀 Future Enhancements

### **1. Content Pillars Integration**
Currently: Shown to AI in prompt  
Future: Strategy engine uses pillars to select vibe/moment posts

### **2. Required Tone Anchors Validation**
Currently: In prompt but not validated  
Future: Post-generation check for required phrases

### **3. CTA Config in Database**
Currently: Code-ready, no database schema  
Future: Migrate field to businesses table

### **4. Performance Metrics**
Currently: No feedback loop  
Future: Track which brand_voice combinations get highest engagement

### **5. Dynamic Prompt Optimization**
Currently: All businesses get same prompt structure  
Future: Adapt prompt based on profile completeness

---

## 📝 Developer Notes

**Adding New Business Profile Field**:

1. **Update Type** (types.ts):
   ```typescript
   export interface BusinessProfile {
     new_field?: string
   }
   ```

2. **Fetch from Database** (data-sources/business-profile.ts):
   ```typescript
   return {
     new_field: data.new_field || ''
   }
   ```

3. **Add to Prompt** (data-sources/business-profile.ts):
   ```typescript
   if (profile.new_field) {
     sections.push(`New Field: ${profile.new_field}`)
   }
   ```

4. **Use in Generation** (prompt-builder.ts / response-formatter.ts / validators/)

**Testing Field Impact**:
- Generate ideas with field present vs. absent
- Compare tone, content focus, and structure
- Measure token usage increase
- Validate AI follows new constraint

---

*Last Updated: January 2026*
*Version: ai-generate-v2 (169.7kB bundle)*
