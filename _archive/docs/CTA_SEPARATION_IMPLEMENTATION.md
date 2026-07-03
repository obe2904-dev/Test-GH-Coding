# CTA Separation Implementation - Complete

## Overview

Implemented comprehensive CTA (Call-to-Action) separation architecture for ai-generate-v2, enabling independent styling and business-level configuration of CTAs separate from post text content.

## Changes Made

### 1. Backend: types.ts (✅ Complete)

**Updated `PlatformPost` interface:**
```typescript
interface PlatformPost {
  platform: 'facebook' | 'instagram'
  text: string  // ONLY hook + caption_base (clean content, no CTA)
  cta: {
    text: string  // "Kom forbi" or "Book dit bord"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // booking_url for Facebook when type='booking', undefined for Instagram
  }
  hashtags: string[]
}
```

**Updated `BusinessProfile` interface:**
```typescript
interface BusinessProfile {
  // ... existing fields
  cta_config?: {
    default_style?: 'soft' | 'booking'  // Default CTA style preference
    custom_ctas?: {
      book?: string      // Custom booking CTA: "Book dit bord nu"
      visit?: string     // Custom visit CTA: "Kom forbi i dag"
      menu?: string      // Custom menu CTA: "Se vores menu"
      engage?: string    // Custom engagement CTA: "Del med os"
    }
    use_emojis?: boolean  // Whether to include emojis in CTAs
  }
}
```

### 2. Backend: response-formatter.ts (✅ Complete)

**Refactored text generation:**
- `formatForFacebook()` - Now builds ONLY hook + caption_base (no CTA, no URL embedded)
- `formatForInstagram()` - Now builds ONLY hook + caption_base (no CTA, no "Link i bio")
- CTA is now a separate object with text, type, and optional URL

**New CTA selection functions:**

1. **`selectCTAText()`** - Smart CTA selection with priority:
   - Priority 1: Business custom CTA from `cta_config.custom_ctas[intent]`
   - Priority 2: Business default style (`cta_config.default_style`)
   - Priority 3: Locale-aware templates from platform-rules.ts
   - Fallback: Generic locale-specific CTAs

2. **`determineCTAType()`** - Classify CTA type:
   - 'custom' - Business has custom CTA configured
   - 'booking' - Direct booking CTA with URL
   - 'soft' - Gentle visit/engage CTA without URL
   - 'menu' - Menu-focused CTA

3. **`shouldIncludeURL()`** - URL inclusion logic:
   - Instagram: NEVER includes URLs
   - Facebook: Includes booking_url ONLY for 'book'/'visit' intents
   - Respects platform rules and business configuration

4. **Helper functions:**
   - `getIntentEmoji()` - Returns emoji for CTA intent (📅, 🚶, 📋, 💬)
   - `getFallbackCTA()` - Locale-specific fallback CTAs when config is missing

**Example output:**

**Facebook:**
```typescript
{
  platform: 'facebook',
  text: "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her med lokale råvarer.",
  cta: {
    text: "📅 Book dit bord nu",
    type: "booking",
    url: "https://booking.viggo.dk"
  },
  hashtags: ["#Viggo", "#København", "#madoplevelser", "#restaurantliv"]
}
```

**Instagram:**
```typescript
{
  platform: 'instagram',
  text: "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her med lokale råvarer.",
  cta: {
    text: "🚶 Kom forbi og oplev stemningen",
    type: "soft",
    url: undefined  // Never on Instagram
  },
  hashtags: [...12 hashtags...]
}
```

### 3. Database: ADD_CTA_CONFIG_COLUMN.sql (✅ Complete)

**Migration file created:**
```sql
-- Add cta_config JSONB column
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS cta_config JSONB DEFAULT NULL;

-- Add comment with structure documentation
COMMENT ON COLUMN business_profile.cta_config IS '...';

-- Create GIN index for efficient querying
CREATE INDEX IF NOT EXISTS idx_business_profile_cta_config 
ON business_profile USING GIN (cta_config);
```

**To apply migration:**
Run in Supabase SQL Editor:
```bash
# Copy contents of ADD_CTA_CONFIG_COLUMN.sql and execute
```

**Example business configuration:**
```sql
UPDATE business_profile 
SET cta_config = jsonb_build_object(
  'default_style', 'soft',
  'use_emojis', true,
  'custom_ctas', jsonb_build_object(
    'book', 'Book dit bord hos os',
    'visit', 'Kom forbi og smag'
  )
)
WHERE id = 'your-business-id';
```

### 4. Frontend: postCreationStore.ts (✅ Complete)

**Updated `GeneratedIdea` interface:**
```typescript
export interface GeneratedIdea {
  // ... existing fields
  _cta?: {
    text: string  // "Kom forbi" or "Book dit bord"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // booking_url for Facebook, undefined for Instagram
  }
  _rawIdea?: any
  _formattedPosts?: {
    facebook?: any
    instagram?: any
  }
}
```

### 5. Frontend: usePostCreationAI.ts (✅ Complete)

**Updated response parsing:**
```typescript
const ideas: GeneratedIdea[] = data.ideas.map((idea: any, index: number) => {
  const instagramPost = data.formatted?.instagram?.[index]
  const facebookPost = data.formatted?.facebook?.[index]
  
  return {
    // ... existing fields
    _cta: instagramPost?.cta || facebookPost?.cta,
    _rawIdea: idea,
    _formattedPosts: { facebook: facebookPost, instagram: instagramPost }
  }
})
```

### 6. Frontend: IdeaCard.tsx (✅ Complete)

**Added CTA rendering section:**
```tsx
{/* CTA Section (if available from V2 API) */}
{idea._cta && (
  <div className="mb-2">
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
      idea._cta.type === 'booking' 
        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
        : 'bg-slate-100 text-slate-700 border border-slate-200'
    }`}>
      <span>{idea._cta.text}</span>
      {idea._cta.url && (
        <ExternalLink className="w-3 h-3" />
      )}
    </div>
  </div>
)}
```

**Styling:**
- **Booking CTAs:** Indigo background with external link icon when URL present
- **Soft CTAs:** Slate gray background, no icon
- Displayed as rounded badge between text and metadata

### 7. Deployment (✅ Complete)

**Deployed to Supabase:**
```bash
npx supabase functions deploy ai-generate-v2
```

✅ Function deployed successfully to project `kvqdkohdpvmdylqgujpn`

## Architecture Benefits

### 1. **Clean Content Separation**
- Post text contains ONLY hook + caption (narrative content)
- CTA is separate object (easy to style/position independently)
- Hashtags remain in separate array

### 2. **Business-Level Configuration**
- Businesses can customize CTAs per intent type
- Choose between soft vs direct booking style
- Toggle emoji usage
- Stored in `business_profile.cta_config` JSONB

### 3. **Platform-Specific Behavior**
- **Facebook:** Shows booking URLs with direct CTAs ("Book dit bord")
- **Instagram:** Never shows URLs, uses soft CTAs ("Kom forbi")
- Platform rules enforced in backend, frontend receives clean data

### 4. **Locale-Aware Defaults**
- Danish: "Kom forbi", "Book dit bord"
- Swedish: "Kom förbi", "Boka bord"
- English: "Visit us", "Book a table"
- Fallback chain ensures graceful degradation

### 5. **Independent Styling**
- Frontend can render CTA as button, badge, or card
- Easy to A/B test different CTA presentations
- Can toggle CTA visibility per platform without changing text

## Usage Examples

### Example 1: Default Behavior (No CTA Config)

**Business Profile:**
```json
{
  "business_name": "Viggo",
  "booking_url": "https://booking.viggo.dk",
  "primary_language": "Danish"
}
```

**Facebook Output:**
```typescript
{
  text: "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her.",
  cta: {
    text: "📅 Book bord nu",  // From locale templates
    type: "booking",
    url: "https://booking.viggo.dk"
  }
}
```

**Instagram Output:**
```typescript
{
  text: "Smag sæsonens bedste retter 🍂\n\nVores efterårsmenu er her.",
  cta: {
    text: "🚶 Kom forbi",  // Soft CTA for Instagram
    type: "soft",
    url: undefined
  }
}
```

### Example 2: Custom Soft CTAs

**Business Profile:**
```json
{
  "cta_config": {
    "default_style": "soft",
    "custom_ctas": {
      "book": "Besøg os i dag",
      "visit": "Kom og smag",
      "engage": "Fortæl os din mening"
    },
    "use_emojis": false
  }
}
```

**Facebook Output (even for book intent):**
```typescript
{
  cta: {
    text: "Besøg os i dag",  // Custom soft CTA, no emoji
    type: "custom",
    url: undefined  // No URL because default_style is 'soft'
  }
}
```

### Example 3: Direct Booking Style

**Business Profile:**
```json
{
  "cta_config": {
    "default_style": "booking",
    "custom_ctas": {
      "book": "Book dit bord hos Viggo nu"
    },
    "use_emojis": true
  },
  "booking_url": "https://booking.viggo.dk"
}
```

**Facebook Output:**
```typescript
{
  cta: {
    text: "📅 Book dit bord hos Viggo nu",  // Custom + emoji
    type: "custom",
    url: "https://booking.viggo.dk"  // URL included
  }
}
```

## Testing Checklist

### Backend Testing

- [ ] **Test without cta_config:** Should use locale-aware templates
- [ ] **Test with custom CTAs:** Should use business custom text
- [ ] **Test default_style='soft':** Should prefer soft CTAs even for booking intent
- [ ] **Test default_style='booking':** Should use direct booking CTAs with URLs
- [ ] **Test use_emojis=false:** Should omit emojis from CTAs
- [ ] **Test Facebook vs Instagram:** URLs only on Facebook
- [ ] **Test different locales:** Danish, Swedish, English fallbacks

### Frontend Testing

- [ ] **CTA displays in IdeaCard:** Should show styled badge below text
- [ ] **Booking CTA styling:** Indigo background with external link icon
- [ ] **Soft CTA styling:** Slate gray background, no icon
- [ ] **CTA with URL:** Shows external link icon
- [ ] **CTA without URL:** No icon
- [ ] **Missing CTA:** Section doesn't render (graceful degradation)

### Database Testing

- [ ] **Run migration:** `cta_config` column created successfully
- [ ] **Set custom config:** JSONB structure validates correctly
- [ ] **Query by config:** GIN index enables efficient queries
- [ ] **NULL config:** Defaults work without config

## Next Steps

### Phase 1: Production Validation (Today)
1. ✅ Deploy ai-generate-v2 function
2. ⏳ Apply database migration (ADD_CTA_CONFIG_COLUMN.sql)
3. ⏳ Test with Viggo's data (generate posts, check CTA rendering)
4. ⏳ Verify Facebook shows URLs, Instagram doesn't

### Phase 2: Business Configuration UI (Future)
1. Add CTA config section to Business Profile settings
2. UI for selecting default_style (soft vs booking)
3. Input fields for custom CTAs per intent type
4. Toggle for emoji usage
5. Preview CTA appearance for Facebook/Instagram

### Phase 3: Advanced Features (Future)
1. **CTA Analytics:** Track clicks, conversions per CTA type
2. **A/B Testing:** Test multiple CTA variants, auto-select winner
3. **Template Library:** Pre-built CTAs by industry/vertical
4. **Seasonal CTAs:** Valentine's Day, Christmas, Summer specials
5. **Multi-language CTAs:** Manage translations per locale

## Success Criteria

✅ **All Complete:**
- [x] PlatformPost.text contains ONLY hook + caption (no CTA, no URL)
- [x] PlatformPost.cta is separate object with text, type, url
- [x] Facebook shows booking URLs for book/visit intents
- [x] Instagram never shows URLs (url=undefined)
- [x] Business can configure custom CTAs via cta_config
- [x] CTAs respect locale (Danish, Swedish, English)
- [x] Frontend renders CTA as styled badge with icon
- [x] Backend deployed to production
- [x] Database migration ready to apply

## Files Changed

### Backend (ai-generate-v2)
- `types.ts` - Added CTA structure to PlatformPost and cta_config to BusinessProfile
- `generators/response-formatter.ts` - Separated CTA from text, added smart selection logic

### Frontend
- `src/stores/postCreationStore.ts` - Added _cta to GeneratedIdea interface
- `src/hooks/usePostCreationAI.ts` - Extract CTA from formatted posts
- `src/components/post-creation/shared/IdeaCard.tsx` - Render CTA as styled badge

### Database
- `ADD_CTA_CONFIG_COLUMN.sql` - Migration to add cta_config JSONB column

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     AI GENERATE V2                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PostIdea (Platform-Neutral)                                │
│  ┌────────────────────────────────────┐                     │
│  │ hook: "Smag sæsonens bedste"       │                     │
│  │ caption_base: "Efterårsmenu..."    │                     │
│  │ cta_intent: "book"                 │                     │
│  │ menu_item: {name, category}        │                     │
│  └────────────────────────────────────┘                     │
│           │                                                  │
│           ▼                                                  │
│  response-formatter.ts                                       │
│  ┌─────────────────────────────────────┐                    │
│  │ selectCTAText()                     │                    │
│  │ ├─ 1. Check custom_ctas             │                    │
│  │ ├─ 2. Check default_style           │                    │
│  │ └─ 3. Fallback to locale templates  │                    │
│  └─────────────────────────────────────┘                    │
│           │                                                  │
│           ▼                                                  │
│  PlatformPost (Facebook)        PlatformPost (Instagram)    │
│  ┌─────────────────────────┐   ┌──────────────────────────┐ │
│  │ text: "hook + caption"  │   │ text: "hook + caption"   │ │
│  │ cta: {                  │   │ cta: {                   │ │
│  │   text: "📅 Book bord"  │   │   text: "🚶 Kom forbi"  │ │
│  │   type: "booking"       │   │   type: "soft"           │ │
│  │   url: "https://..."    │   │   url: undefined         │ │
│  │ }                       │   │ }                        │ │
│  │ hashtags: [...]         │   │ hashtags: [...]          │ │
│  └─────────────────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  IdeaCard Component                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ <div className="text-content">                       │   │
│  │   {idea.text}  ← Clean content (no CTA)             │   │
│  │ </div>                                               │   │
│  │                                                      │   │
│  │ <div className="cta-badge">                          │   │
│  │   {idea._cta.text}  ← Styled separately             │   │
│  │   {idea._cta.url && <ExternalLinkIcon />}           │   │
│  │ </div>                                               │   │
│  │                                                      │   │
│  │ <div className="hashtags">                           │   │
│  │   {idea.hashtags}  ← Separate section               │   │
│  │ </div>                                               │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Notes

- **Backward Compatibility:** If no `_cta` field exists, component gracefully skips rendering (no errors)
- **Database Migration:** Migration uses `IF NOT EXISTS` to prevent errors on re-run
- **Default Behavior:** Without `cta_config`, system uses locale-aware templates (existing behavior preserved)
- **Performance:** GIN index on `cta_config` enables efficient queries (`WHERE cta_config->>'default_style' = 'soft'`)

---

**Implementation Date:** 2024-01-XX  
**Status:** ✅ Complete - Ready for production testing  
**Next Action:** Apply database migration and test with real data
