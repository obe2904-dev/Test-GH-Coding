# Brand Profile Setup Guide

**Version:** 1.0  
**Date:** February 4, 2026  
**Feature:** AI-Generated Brand Profile with Voice Pattern Extraction

---

## Overview

The Brand Profile feature generates an AI-powered brand strategy by analyzing your business data and extracting authentic voice patterns from your actual writing. This creates personalized content that sounds like YOU, not generic AI text.

**Key Capabilities:**
- ✅ AI analysis of 5-8 data sources (menu, website, social media, photos)
- ✅ Voice pattern extraction (signature phrases, humor level, writing style)
- ✅ Brand essence and tone definition
- ✅ Core offerings identification
- ✅ Target audience profiling
- ✅ Content pillar recommendations
- ✅ User-editable results

---

## Access

**Location:** Dashboard → Setup → "8. Brand Profil (AI)"

**URL:** `/dashboard/brand-v5`

**Availability:** All users (tier lock removed)

---

## Prerequisites

### 1. Business Data Required
Before generating a brand profile, ensure you have:

- ✅ Business name and location
- ✅ Menu uploaded and extracted
- ✅ Website URL (optional but recommended for voice extraction)
- ✅ Social media accounts linked (optional)
- ✅ Business description written (used for voice pattern analysis)

### 2. Production Environment Setup

The brand profile generator runs as a Supabase Edge Function and requires deployment to production.

---

## Deployment Steps

### Step 1: Deploy OpenAI API Key

```bash
npx supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx --project-ref kvqdkohdpvmdylqgujpn
```

**Replace** `sk-proj-xxxxxxxxxxxxx` with your actual OpenAI API key.

**Why needed:** The brand profile generator uses GPT-4o to analyze your business data and extract voice patterns.

### Step 2: Deploy Edge Function

```bash
npx supabase functions deploy brand-profile-generator-v5 --project-ref kvqdkohdpvmdylqgujpn
```

**What this does:**
- Deploys the brand profile generator to production
- Makes it accessible from your live app
- Links it with the OpenAI key you set in Step 1

### Step 3: Verify Deployment

```bash
npx supabase functions list --project-ref kvqdkohdpvmdylqgujpn
```

**Expected output:** You should see `brand-profile-generator-v5` in the list.

---

## Usage Workflow

### 1. Navigate to Brand Profile Page

From dashboard: **Setup → Brand Profil (AI)**

### 2. Generate Profile

If no profile exists or existing profile is empty, you'll see the generator view with a **"Generer Brand Profil"** button.

**Click to start generation.**

### 3. Wait for AI Analysis (10-20 seconds)

The system will:
- Analyze menu items and categories
- Extract text from business descriptions
- Scrape website content (if URL provided)
- Examine uploaded photos and AI labels
- Identify location context and patterns
- **Extract voice patterns** from your actual writing

### 4. Review Generated Profile

The AI generates 6 sections:

**A. Brand Essence & Tone**
- Tone keywords (hyggelig, autentisk, professionel)
- Voice style (du-form, emoji usage)

**B. Core Offerings (Top 3)**
- Main products/services
- Example: "Klassisk dansk brunch, Åens bedste pariserbøf, Hyggeligt terrassemiljø"

**C. Things to Avoid**
- Content to exclude
- Example: "Generic stock photos, overused hashtags, pushy CTAs"

**D. Content Pillars (3-5 themes)**
- Core messaging themes
- Example: "Traditionsrig madkultur, Lokal stolthed, Åens atmosfære"

**E. Target Audience**
- Primary segments
- Example: "Young professionals (25-40), Families with kids"

**F. Voice Patterns** (NEW - Feb 2026)
- **Signature phrases:** Real quotes from your writing
- **Personality traits:** Humor level, formality, storytelling style
- **Brand context:** Origin story, unique differentiator, local landmarks

### 5. Edit & Save

All fields are editable. Click **"Gem"** (Save) when satisfied.

---

## Voice Pattern Extraction (Layer 2 Enhancement)

### The Authenticity Problem

Generic AI captions lack personality:
- ❌ "Vintermad der varmer! 🥘" (could describe ANY restaurant)
- ✅ "Den her gryde har reddet os siden 98" (authentic, specific to YOUR business)

### Data Sources Analyzed

The AI examines your actual writing from:

1. **`business_profile` table**
   - Short description
   - Long description
   - Menu description

2. **`website_analyses` table**
   - Homepage text
   - About page content
   - Scraped website copy

3. **`social_accounts` table**
   - Social media handles (for future post scraping)

### Extracted Patterns (3 JSONB Columns)

**1. `voice_execution`** - How you actually write
```json
{
  "signature_phrases": [
    {
      "phrase": "Den her gryde har reddet os siden 98",
      "source": "business_description",
      "usage_context": "Heritage posts"
    }
  ],
  "typical_openings": [
    "God morgen fra Åen! ☕",
    "Velkommen til endnu en hyggelig dag"
  ],
  "writing_patterns": {
    "sentence_length": "short",
    "emoji_frequency": "moderate",
    "punctuation_style": "standard"
  }
}
```

**2. `personality`** - Voice characteristics
```json
{
  "humor_level": "subtle",
  "formality": "casual",
  "storytelling_style": "contextual"
}
```

**3. `brand_context`** - Local/unique elements
```json
{
  "origin_story": "Founded by chef in 1998, riverside location",
  "unique_differentiator": "Traditional Danish cuisine with modern twist",
  "local_landmarks": ["Åen", "Aarhus River", "City center"]
}
```

### Impact on Content Generation

**Before voice extraction:**
- AI invents generic phrases
- "Hyggelig, autentisk" → "Vintermad der varmer! 🥘"

**After voice extraction:**
- AI references your actual language
- Signature phrases → "Den her gryde har reddet os siden 98"
- Local landmarks → "Åen" instead of generic "waterfront"

---

## Database Schema

### Tables Updated

**`business_brand_profile`** - New columns added:
```sql
ALTER TABLE business_brand_profile
ADD COLUMN voice_execution jsonb,  -- Signature phrases, openings, patterns
ADD COLUMN personality jsonb,      -- Humor, formality, storytelling
ADD COLUMN brand_context jsonb;    -- Origin story, differentiator, landmarks

-- GIN indexes for efficient querying
CREATE INDEX idx_brand_profile_voice_patterns 
ON business_brand_profile USING gin (voice_execution);
```

### Migration

**File:** `supabase/migrations/20260204000000_add_voice_patterns.sql`

**Status:** ✅ Applied in production

---

## Edge Function Architecture

### Function: `brand-profile-generator-v5`

**Location:** `supabase/functions/brand-profile-generator-v5/`

**Process Flow:**

1. **Data Gathering** (`services/data-gatherer.ts`)
   - Collects business knowledge from 8+ tables
   - Extracts menu items, descriptions, website text
   - Compiles voice pattern source data

2. **AI Analysis** (`services/ai-generator.ts`)
   - Calls OpenAI GPT-4o API
   - Two-stage analysis:
     - Stage A: Internal evidence extraction
     - Stage B: User-facing profile generation
   - Extracts voice patterns with evidence-based validation

3. **Validation** (`services/validator.ts`)
   - Ensures all claims reference verbatim evidence
   - Validates confidence scoring
   - Checks output structure

4. **Storage**
   - Saves to `business_brand_profile` table
   - Stores voice patterns in JSONB columns
   - Returns complete profile to frontend

**API Endpoint:**
```
POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5
```

---

## Troubleshooting

### Error: "Failed to send a request to the Edge Function"

**Cause:** Edge Function not deployed or OpenAI key missing

**Solution:**
```bash
# Deploy OpenAI key
npx supabase secrets set OPENAI_API_KEY=sk-xxx --project-ref kvqdkohdpvmdylqgujpn

# Deploy function
npx supabase functions deploy brand-profile-generator-v5 --project-ref kvqdkohdpvmdylqgujpn
```

### Error: "Invalid API key" (401)

**Cause:** Wrong Supabase anon key in `.env.local`

**Solution:**
```bash
# Get correct key
npx supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn

# Update .env.local with the anon key shown
# Restart Vite: npm run dev
```

### Profile Shows Empty

**Cause:** No data sources available for analysis

**Solution:**
- Add business description in onboarding
- Upload and extract menu
- Add website URL
- Wait for website analysis to complete

### Voice Patterns Empty

**Cause:** Insufficient writing samples

**Solution:**
- Write detailed business descriptions
- Add website with text content
- Link social media accounts
- Voice extraction requires at least 100 words of source text

---

## Environment Variables

### Required in `.env.local`

```bash
# Production Supabase (for frontend)
VITE_SUPABASE_URL=https://kvqdkohdpvmdylqgujpn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI API (local testing only)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

### Required in Production Secrets

```bash
# Set via Supabase CLI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

---

## Frontend Components

### Main Page

**File:** `src/pages/dashboard/BrandProfilePageV5.tsx`

**Features:**
- Detects empty vs populated profile
- Shows generator view or display view
- Fixed infinite re-render loop (useEffect dependency)
- Added empty profile detection logic

### Generator Hook

**File:** `src/hooks/useBrandProfileGeneration.ts`

**Functionality:**
- Calls Edge Function
- Handles loading states
- Error handling
- Success callbacks

### Sidebar Navigation

**File:** `src/components/layout/Sidebar.tsx`

**Entry:** "8. Brand Profil (AI)" under Setup section

**Badge:** "NY" (new feature indicator)

**Icon:** SparklesIcon

---

## Testing Checklist

### Pre-Deployment
- [ ] Business data exists in production
- [ ] OpenAI API key is valid
- [ ] Edge Function code is committed

### Post-Deployment
- [ ] Login works (correct anon key)
- [ ] Business shows in dashboard
- [ ] Brand Profile link visible in sidebar
- [ ] Clicking link navigates to `/dashboard/brand-v5`
- [ ] Generator button shows if no profile
- [ ] Click generates profile (10-20 seconds)
- [ ] Profile displays with all 6 sections
- [ ] Voice patterns populated (if data available)
- [ ] Edit mode allows changes
- [ ] Save persists changes

---

## Production URLs

**Supabase Project:** https://kvqdkohdpvmdylqgujpn.supabase.co

**Project Reference:** `kvqdkohdpvmdylqgujpn`

**Edge Function:** `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5`

**Frontend:** `http://localhost:3003` (development)

---

## Related Documentation

- [CONTENT_GENERATION_LAYERS_1_TO_9.md](./CONTENT_GENERATION_LAYERS_1_TO_9.md) - Layer 2: Strategic Baselines section
- [AI_GENERATE_V3_SPEC.md](./AI_GENERATE_V3_SPEC.md) - AI generation architecture
- [BRAND_PROFILE_GENERATION_FLOW.md](./BRAND_PROFILE_GENERATION_FLOW.md) - Detailed flow diagrams

---

## Summary

**What:** AI-generated brand profile with voice pattern extraction  
**Why:** Authentic content that sounds like the business owner, not generic AI  
**How:** Analyzes 5-8 data sources + extracts real writing patterns  
**Deploy:** 2 commands (set secret + deploy function)  
**Time:** 10-20 seconds per generation  
**Result:** 6-section brand profile + 3 JSONB voice pattern objects

---

**End of Document**
