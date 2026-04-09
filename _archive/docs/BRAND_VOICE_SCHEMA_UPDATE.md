# Brand Voice Schema Update - Completed ✅

## Summary
Added 9 canonical brand voice variables to the `business_brand_profile` table to provide explicit brand guidance for AI content generation.

## What Was Done

### 1. Database Migration Created
**File:** [ADD_BRAND_VOICE_COLUMNS.sql](ADD_BRAND_VOICE_COLUMNS.sql)

Added 9 new TEXT columns to `business_brand_profile`:

#### 5-Star Priority (Critical for Brand Consistency)
- `brand_essence` - Core brand identity, mission, what makes the brand unique
- `tone_of_voice` - Communication style, how AI should speak for the brand  
- `things_to_avoid` - Guardrails, words/phrases/topics AI should never use

#### 4-Star Priority (High Impact)
- `target_audience` - Primary audience demographics, interests, needs
- `core_offerings` - Primary products/services AI can reference
- `content_focus` - Content themes and topics to emphasize
- `cta_style` - Call-to-action style preference (direct, soft, urgent, etc.)
- `communication_goal` - Overall communication objective (trust, sales, education, etc.)

#### 3-Star Priority (Supporting)
- `image_preferences` - Visual style and image preferences

### 2. TypeScript Types Updated
**File:** [src/types/database.ts](src/types/database.ts#L186-L234)

Updated the `business_brand_profile` interface with all 9 new columns in:
- `Row` (read operations)
- `Insert` (create operations)  
- `Update` (update operations)

All fields are nullable (`string | null`) to allow gradual adoption.

## How to Apply the Migration

### Option 1: Supabase SQL Editor (Recommended)
1. Open your Supabase project
2. Go to SQL Editor
3. Copy the contents of `ADD_BRAND_VOICE_COLUMNS.sql`
4. Run the query
5. Verify the columns appear in the verification query at the bottom

### Option 2: Supabase CLI
```bash
supabase db push
```

### Option 3: Manual psql
```bash
psql "your-connection-string" < ADD_BRAND_VOICE_COLUMNS.sql
```

## Verification

After running the migration, you should see output like:
```
 column_name         | data_type | is_nullable | column_default 
---------------------+-----------+-------------+----------------
 brand_essence       | text      | YES         | 
 cta_style          | text      | YES         | 
 communication_goal | text      | YES         | 
 content_focus      | text      | YES         | 
 core_offerings     | text      | YES         | 
 image_preferences  | text      | YES         | 
 target_audience    | text      | YES         | 
 things_to_avoid    | text      | YES         | 
 tone_of_voice      | text      | YES         | 
```

## Database Structure

### Before
```sql
business_brand_profile
├── business_id (FK)
├── tone_keywords (text[])
├── voice_style (text)
├── values (text[])
├── certifications (text[])
├── do_not_say (jsonb)
├── created_at
└── updated_at
```

### After
```sql
business_brand_profile
├── business_id (FK)
├── tone_keywords (text[]) -- Legacy
├── voice_style (text) -- Legacy
├── values (text[]) -- Legacy
├── certifications (text[]) -- Legacy
├── do_not_say (jsonb) -- Legacy
├── brand_essence (text) ⭐⭐⭐⭐⭐
├── tone_of_voice (text) ⭐⭐⭐⭐⭐
├── things_to_avoid (text) ⭐⭐⭐⭐⭐
├── target_audience (text) ⭐⭐⭐⭐☆
├── core_offerings (text) ⭐⭐⭐⭐☆
├── content_focus (text) ⭐⭐⭐⭐☆
├── cta_style (text) ⭐⭐⭐⭐☆
├── communication_goal (text) ⭐⭐⭐⭐☆
├── image_preferences (text) ⭐⭐⭐☆☆
├── created_at
└── updated_at
```

## Variable Purpose Reference

### {{brand_essence}} ⭐⭐⭐⭐⭐
**Purpose:** Core brand identity
**Example:** "Vi er en familierestaurant der værdsætter autentiske italienske retter og hyggeligt samvær. Vores passion er at bringe folk sammen omkring et bord fyldt med kærlighed og tradition."
**AI Use:** Forms the foundation of all content - what makes this brand unique

### {{tone_of_voice}} ⭐⭐⭐⭐⭐
**Purpose:** Communication style
**Example:** "Venlig og afslappet med et strejf af humor. Vi taler som en god ven - hjælpsom og varm, aldrig overdrevent formelt."
**AI Use:** Determines language style, formality, personality

### {{things_to_avoid}} ⭐⭐⭐⭐⭐
**Purpose:** Guardrails
**Example:** "Ingen slang eller unødvendigt engelsk. Undgå overdrivelser som 'verdens bedste' eller 'aldrig set før'. Nævn aldrig konkurrenter direkte."
**AI Use:** Hard constraints - what AI must never do

### {{target_audience}} ⭐⭐⭐⭐☆
**Purpose:** Who we're speaking to
**Example:** "Familier med børn 25-45 år, bosat lokalt, værdsætter kvalitet og tryghed. Søger autentiske oplevelser og lokal service."
**AI Use:** Shapes language, references, and content relevance

### {{core_offerings}} ⭐⭐⭐⭐☆
**Purpose:** What we offer
**Example:** "Håndlavede pizzaer, frisk pasta, italienske vine. Specialitet: 48-timers surdej og autentiske neapolitanske retter."
**AI Use:** Ensures AI references real products/services accurately

### {{content_focus}} ⭐⭐⭐⭐☆
**Purpose:** What we talk about
**Example:** "Hverdagsmad der gør en forskel, familieøjeblikke, italiensk madkultur, sæsonbaserede retter, bag-om-køkkenet historier."
**AI Use:** Guides topic selection and content themes

### {{cta_style}} ⭐⭐⭐⭐☆
**Purpose:** How we drive action
**Example:** "Blød og inviterende - 'Kom forbi og smag' frem for 'Book NU!'. Lad handling føles naturlig og ikke presset."
**AI Use:** Determines call-to-action approach

### {{communication_goal}} ⭐⭐⭐⭐☆
**Purpose:** What we aim to achieve
**Example:** "Bygge tillid og fællesskab. Vi vil ikke bare sælge mad - vi vil skabe relationer og gøre os til en naturlig del af familiernes hverdag."
**AI Use:** Aligns content with business objectives

### {{image_preferences}} ⭐⭐⭐☆☆
**Purpose:** Visual style
**Example:** "Autentiske fotos af mad og mennesker, varme farver, naturligt lys. Undgå overstiliserede eller kunstige billeder."
**AI Use:** Guides image selection and visual content recommendations

## Next Steps

### 1. Apply Migration ✅ (DONE)
- [x] Created SQL migration file
- [x] Updated TypeScript types
- [ ] **YOU:** Run migration in Supabase

### 2. Update AI Prompt Logic (Next Task)
**File to edit:** `supabase/functions/ai-enhance/index.ts`

**Strategy:** Create separate BRAND VOICE section in AI prompt around line 260-295

**Structure:**
```typescript
// Keep existing businessContext (facts, hours, menu)
let businessContext = '...'  // Current implementation

// NEW: Add separate brand voice section
let brandVoiceContext = ''
if (businessProfile) {
  const brandParts = []
  
  // 5-star priority
  if (businessProfile.brand_essence) {
    brandParts.push(`Brand Essence: ${businessProfile.brand_essence}`)
  }
  if (businessProfile.tone_of_voice) {
    brandParts.push(`Tone of Voice: ${businessProfile.tone_of_voice}`)
  }
  if (businessProfile.things_to_avoid) {
    brandParts.push(`Things to AVOID: ${businessProfile.things_to_avoid}`)
  }
  
  // 4-star priority
  if (businessProfile.target_audience) {
    brandParts.push(`Target Audience: ${businessProfile.target_audience}`)
  }
  // ... rest of brand variables
  
  if (brandParts.length > 0) {
    brandVoiceContext = `\n\nBRAND VOICE GUIDELINES:\n${brandParts.join('\n')}`
  }
}

// In enhancementPrompt:
const enhancementPrompt = `...
${businessContext}${brandVoiceContext}
...`
```

### 3. Test & Validate
- [ ] Test with brand variables populated
- [ ] Test with brand variables empty (should fallback gracefully)
- [ ] Verify AI respects brand guidelines
- [ ] Test across different tiers (free, standardplus, premium)

## Files Modified

1. ✅ `ADD_BRAND_VOICE_COLUMNS.sql` - Database migration (NEW)
2. ✅ `src/types/database.ts` - TypeScript types (UPDATED)
3. ✅ `BRAND_VOICE_SCHEMA_UPDATE.md` - This documentation (NEW)
4. ⏳ `supabase/functions/ai-enhance/index.ts` - AI prompt integration (NEXT)
5. ⏳ `src/pages/dashboard/BrandProfilePage_NEW.tsx` - UI already has the 9 variables (READY)

## Notes

- All new columns are nullable to allow gradual adoption
- Legacy columns (`tone_keywords`, `voice_style`, etc.) are preserved for backward compatibility
- Column comments added for future reference
- TypeScript types are fully typed and match database schema
- The UI in `BrandProfilePage_NEW.tsx` already handles all 9 variables

---

**Status:** Database schema ready ✅ | TypeScript types updated ✅ | Ready for AI prompt integration ⏳
