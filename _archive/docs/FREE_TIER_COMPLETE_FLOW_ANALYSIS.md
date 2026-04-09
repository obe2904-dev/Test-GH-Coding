# FREE TIER COMPLETE FLOW ANALYSIS

## 📊 Complete Data Flow: Onboarding → Profile → AI Ideas → Text Generation

---

## 1️⃣ ONBOARDING PROCESS

### Steps (3-step wizard):

**Step 1: Business Name + Website URL**
- User enters business name
- User enters website URL (optional)
- If website provided → AI analyzes website
- If no website → manual selection mode

**Step 2a: Website Analysis Result (if URL provided)**
- Shows analyzed data from `analyze-website` function:
  - Business name (detected)
  - Business type (detected)
  - Logo (if found)
  - Contact info (phone, email, address)
  - Menu structure (basic - saved to `business_profile.menu_signal`)
  - Opening hours (if found)
  - Amenities (outdoor seating, takeaway, delivery)
- User reviews and confirms

**Step 2b: Manual Selection (if no URL)**
- User manually selects:
  - Serves coffee? yes/no
  - Serves food? yes/no
  - Serves drinks? yes/no
  - Serves brunch? yes/no
  - Serves bar? yes/no
  - Takeaway? yes/no

**Step 3: Platform Selection + Location**
- User selects platforms (Facebook, Instagram, LinkedIn, TikTok)
- User enters:
  - Postal code (4 digits, required)
  - City (required)
  - Country (default: Danmark)

### Data Saved to Database:

**`businesses` table:**
```sql
{
  owner_id: user.id,
  name: business_name,
  vertical: business_vertical, -- 'cafe', 'restaurant', etc.
  website_url: normalized_url, -- NULL if manual onboarding
  primary_language: 'da',
  plan: 'free',
  created_at: NOW(),
  updated_at: NOW()
}
```

**`business_locations` table:**
```sql
{
  business_id: created_business_id,
  postal_code: postal_code,
  city: city,
  country: country,
  is_primary: true,
  created_at: NOW()
}
```

**`profiles` table (auth metadata):**
```sql
{
  selected_platforms: ['facebook', 'instagram'], -- JSONB array
  onboarding_completed: true,
  updated_at: NOW()
}
```

**`business_profile` table (if website analyzed):**
```sql
{
  business_id: created_business_id,
  website_analysis_data: {
    businessName: "Detected name",
    businessType: "cafe",
    contact: { phone, email, address },
    offerings: {
      menuStructure: [
        {
          category: "Breakfast",
          items: [
            { name: "Scrambled eggs", description: "...", price: "65 kr" }
          ]
        }
      ]
    },
    takeaway: true,
    delivery: false,
    outdoorSeating: true
  },
  menu_signal: {
    hasMenu: true,
    menuDescription: "Danish breakfast & lunch",
    menuCategories: ["Breakfast", "Lunch", "Drinks"],
    signatureItems: ["Scrambled eggs", "Avocado toast", "Cappuccino", "Croissant", "Smoothie"]
  }
}
```

---

## 2️⃣ PROFILE PAGE (`/dashboard/setup/profile`)

### Data Displayed (Editable):

**Basic Info:**
- Business name
- Business sector (dropdown)
- Business category (free text)
- Website URL
- Logo URL

**Location:**
- Address (street)
- Postal code
- City
- Country

**Contact:**
- Phone
- Email
- Booking link

**About:**
- About text (description)

**Menu (Read-only in FREE, shows from `menu_signal`):**
- Menu description
- Menu highlights (list of signature items)

**Opening Hours:**
- Monday-Sunday schedule (open/close times)

**Service Info:**
- Services offered (checkboxes)

### Data Sources for Profile Page:

**FREE tier reads from:**
1. `businesses` table (name, vertical, website_url)
2. `business_locations` table (address, postal_code, city, country)
3. `business_profile` table:
   - `website_analysis_data.contact` (phone, email)
   - `menu_signal.signatureItems` (menu highlights - read-only)
   - `menu_signal.menuDescription` (menu description - read-only)

**PAID tier additionally has:**
- Editable menu fields
- Access to `menu_results_v2` (detailed AI-extracted menu)
- Brand voice configuration
- Advanced analytics

---

## 3️⃣ AI IDEAS GENERATION (`AI Idéer` tab in `Lav Opslag`)

### Function: `get-quick-suggestions`

### Inputs:
```typescript
{
  businessId: string,
  count: 3-8,        // Usually 8 for UI
  tier: 'free',
  regenerate: false  // Use cached if available
}
```

### Data Sources (FREE TIER):

**Business Context:**
- `businesses.name` - Business name
- `businesses.vertical` - Business type (cafe, restaurant, etc.)
- `business_locations.city` - For weather API
- `business_operations.has_outdoor_seating` - For outdoor posts

**Menu Context (FREE - Basic):**
- Source: `business_profile.menu_signal.signatureItems`
- Max items: **5 menu items**
- Format: Just item names (no descriptions, no prices)
- Example: `["Scrambled eggs", "Avocado toast", "Cappuccino", "Croissant", "Smoothie"]`

**Weather Context:**
- OpenWeather API (current + 24h forecast)
- Current temp, wind speed, sunny/cloudy
- Season detection (vinter/forår/sommer/efterår)
- Outdoor suitability check (temp ≥15°C, wind <5 m/s, sunny)

**Tone of Voice (FREE):**
- Always uses **safe hospitality fallback**:
  ```typescript
  {
    formalityLevel: 'casual',
    addressForm: 'du-tiltale',
    sentenceStyle: 'beskrivende',
    personalityTraits: ['varm', 'inviterende']
  }
  ```

### AI Prompt Structure:

```
Lav 8 post-forslag for [Business Name] ([vertical]) i [city].

VEJR I DAG: [current weather]
SÆSON: [season]
UDESERVERING: [outdoor suitability]
RETTER FRA MENUEN (vælg fra disse): [5 signature items]

TONE OF VOICE:
- Formalitet: casual
- Tiltaleform: du-tiltale
- Sætningsstil: beskrivende
- Personlighed: varm, inviterende

REGLER:
1. Præcis 8 forslag med variation: 
   - 1-2 menu_item (MUST use items from menu list above)
   - 2-3 atmosphere
   - 1-2 behind_scenes
   - 1-2 seasonal
2. Title: 3-7 ord, naturligt dansk
3. Why_explanation: 2-3 sætninger (marketing strategy explanation)
4. Photo_idea: 1 sætning (concrete photo suggestion)
5. KUN 1-2 forslag må nævne vejr (show AI can do more!)
6. Udeservering: KUN hvis "PERFEKT vejr" angivet

Return JSON array with title, why_explanation, photo_idea, content_type
```

### AI Model: Gemini 2.5 Flash
- Temperature: 0.5
- Response format: JSON array
- Output: 8 suggestions

### Content Type Distribution:
- **menu_item**: 1-2 suggestions (uses menu items from the 5-item list)
- **atmosphere**: 2-3 suggestions (ambiance, vibe, experience)
- **behind_scenes**: 1-2 suggestions (team, preparation, story)
- **seasonal**: 1-2 suggestions (holidays, seasons, events)

### Example Output:
```json
[
  {
    "title": "Vores scrambled eggs er friske og mættende",
    "why_explanation": "Menu-baseret indhold med høj engagement. Perfekt til frokost-trafik kl. 11-13. Visuelt appetitvækkende.",
    "photo_idea": "Close-up af scrambled eggs med purløg, naturligt vindueslys",
    "content_type": "menu_item"
  },
  {
    "title": "Hyggelig atmosfære og god kaffe",
    "why_explanation": "Følelsesmæssig forbindelse. Appellerer til stammegæster og nye besøgende. Skaber fællesskabsfølelse.",
    "photo_idea": "Wide shot af café med gæster, varmt lys",
    "content_type": "atmosphere"
  },
  ...
]
```

### Saved to Database:
- Table: `daily_suggestions`
- Cached for 24 hours (date = today)
- Fields: id, business_id, title, rationale, why_explanation, photo_idea, content_type, suggested_time, date, position

---

## 4️⃣ TEXT GENERATION (From Selected AI Idea)

### User Action:
1. User sees 8 AI ideas in "AI Idéer" tab
2. User **double-clicks** one idea
3. Arrow button appears
4. User clicks arrow → triggers text generation

### Function: `generate-text-from-idea`

### Inputs:
```typescript
{
  businessId: string,
  suggestion: {
    id: number,
    title: "Dagens lunch er frisk og mættende",
    rationale: "Perfekt til den travle arbejdsdag",
    contentType: "menu_item"
  },
  platforms: ["facebook", "instagram"],
  tier: "free"
}
```

### Data Sources (FREE TIER):

**Business Context:**
- `businesses.name` - Business name
- `businesses.vertical` - Business type
- `business_locations.city` - For location context

**Menu Context (TIER-SPECIFIC - THIS IS KEY!):**

**FREE tier:**
- Source: `business_profile.website_analysis_data.offerings.menuStructure`
- Max items: **5 menu items**
- Format: **Item names only** (no descriptions, no prices)
- Purpose: Basic context from website scan

**PAID tier:**
- Source: `menu_results_v2.structured_data` (AI-extracted detailed menu)
- Max items: **10 menu items**
- Format: **Name + full description + price**
- Purpose: Rich menu data from paid menu extraction feature

### AI Prompt Structure (FREE):

```
Skriv en social media tekst for [Business Name] ([vertical] i [city]).

IDÉ: [suggestion.title]
KONTEKST: [suggestion.rationale]

RETTER FRA MENUEN:
[5 menu item names only]
⚠️ Brug KUN retter/ingredienser fra listen ovenfor. Opfind ingen nye.

KRAV:
1. Længde: 200-300 tegn (inkl. emojis og CTA)
2. Struktur: 2-3 korte sætninger
3. Tone: Naturligt dansk, varm og imødekommende, "du"-form
4. Emojis: Inkluder 1-2 emojis naturligt i teksten
5. Nævn KUN retter fra menulisten ovenfor (for menu_item posts)

6. AFSLUT teksten med ÉN af disse CTAs (vælg den mest passende):
   • Kig forbi i dag ☀️
   • Vi ses snart? 😊
   • Find os i weekenden 🙌
   • Book et bord snart 🍽️
   • Tag den du vil dele det med 👇

EKSEMPEL:
"Vores nye focaccia er lige kommet ud af ovnen 🍞 Italiensk brød med rosmarin og havsalt, sprødt og duftende. Kig forbi i dag ☀️"

Skriv NU teksten (kun teksten, ingen forklaringer eller hashtags):
```

### AI Model: GPT-4o-mini
- System message: "Du er en professionel social media content writer"
- Temperature: 0.7
- Max tokens: 200
- Top_p: 0.9

### Processing Steps:

1. **Fetch menu context** (tier-specific)
2. **Map content type to CTA category:**
   - menu_item → 'visit' CTAs
   - atmosphere → 'social' CTAs
   - behind_scenes → 'engagement' CTAs
   - seasonal → 'save' CTAs

3. **Build prompt** with 4-5 CTA options

4. **Call GPT-4o-mini** → Generate 200-300 char text

5. **Extract CTA** from generated text:
   - Check if any CTA from pool appears in text
   - If found: use that CTA
   - If not found: use first CTA from pool (fallback)

6. **Generate hashtags** (deterministic):
   - Facebook: 3-5 hashtags (brand, city, vertical)
   - Instagram: 10-15 hashtags (more diverse)

7. **Return response:**
```json
{
  "sharedText": "Generated caption with integrated CTA",
  "facebook": {
    "text": "Same caption",
    "hashtags": ["#CafeFaust", "#Aarhus", "#ÅrhusC", "#DanskMad"],
    "cta": {
      "text": "Vi ses snart? 😊",
      "type": "soft"
    }
  },
  "instagram": {
    "text": "Same caption",
    "hashtags": ["#CafeFaust", "#Aarhus", "#ÅrhusC", "#SpisIAarhus", "#DanskMad", "#Frokost", "#Madglæde", "#Café", "#KaffeOgKage", "#SpisLokalt", "#MadElsker", "#DanskGastronomi"],
    "cta": {
      "text": "Vi ses snart? 😊",
      "type": "soft"
    }
  }
}
```

### Frontend Integration:

8. **CreatePostPage** receives response
9. **Populates Design tab** with:
   - Post headline (from idea title)
   - Generated caption text
   - Hashtags (merged from both platforms)
   - Photo idea (from AI suggestion)
   - Platform-specific content for FB/IG

10. **User sees** in Design tab:
    - Text field: Pre-filled with generated caption
    - Hashtags section: Checkboxes for each hashtag
    - Platform tabs: Can see FB/IG specific content
    - Can edit, adjust, and publish

---

## 🔑 KEY DIFFERENCES: FREE vs PAID

### Menu Data:

| Feature | FREE Tier | PAID Tier |
|---------|-----------|-----------|
| **Source** | `business_profile.menu_signal` | `menu_results_v2` (AI extraction) |
| **Data Quality** | Basic (from website scan) | Detailed (AI-extracted) |
| **Items Count** | 5 items max | 10 items max |
| **Format** | Names only | Name + description + price |
| **Editing** | Read-only | Editable |
| **Update Method** | Re-scan website | AI menu extraction job |

### AI Ideas Generation:

| Feature | FREE Tier | PAID Tier |
|---------|-----------|-----------|
| **Menu Items** | 5 signature items | 20 items with details |
| **Tone of Voice** | Safe fallback (preset) | Custom brand voice |
| **Suggestions** | 8 ideas | 8+ ideas (more variety) |
| **Menu Context** | Item names only | Full descriptions + ingredients |

### Text Generation:

| Feature | FREE Tier | PAID Tier |
|---------|-----------|-----------|
| **Menu Context** | 5 item names | 10 items with descriptions + prices |
| **CTA** | Curated pool (AI selects) | Same (for now) |
| **Hashtags** | Deterministic (3-5 FB, 10-15 IG) | Same (for now) |
| **Brand Voice** | Generic "varm, inviterende" | Custom brand profile (future) |

---

## 🔄 COMPLETE USER JOURNEY (FREE TIER)

### New User Signup → First Post:

```
1. Sign up → Onboarding wizard
   ↓
2. Enter business name + website → AI analyzes
   ↓
3. Confirm analysis + enter location → Saved to database
   ↓
4. Select platforms → Complete onboarding
   ↓
5. Dashboard → "Lav Opslag"
   ↓
6. "AI Idéer" tab → AI generates 8 suggestions
   ↓
   Data used:
   - Business name, vertical, city (from onboarding)
   - 5 menu items (from website scan → menu_signal)
   - Current weather (OpenWeather API)
   - Generic tone of voice (casual, du-tiltale)
   ↓
7. User sees 8 ideas (menu_item, atmosphere, behind_scenes, seasonal)
   ↓
8. User double-clicks one idea → Arrow button appears
   ↓
9. Click arrow → generate-text-from-idea called
   ↓
   Data used:
   - Idea title + rationale
   - 5 menu item names (from profile)
   - Business context (name, vertical, city)
   ↓
10. GPT-4o-mini generates 200-300 char caption
    ↓
11. CTA extracted from text
    ↓
12. Hashtags added (deterministic)
    ↓
13. Design tab populated with:
    - Caption text
    - Hashtags
    - Photo idea
    - Platform-specific content
    ↓
14. User edits/adjusts → Publishes to Facebook/Instagram
```

---

## 📝 IMPORTANT NOTES

### Menu Data Flow (FREE):

1. **Onboarding**: Website analyzed → `menu_signal` created
   - signatureItems: ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"]

2. **AI Ideas**: Uses those 5 items to generate menu_item suggestions
   - Prompt includes: "RETTER FRA MENUEN: Item 1, Item 2, Item 3, Item 4, Item 5"
   - AI creates idea like: "Vores scrambled eggs er friske"

3. **Text Generation**: Re-fetches those same 5 items from profile
   - Prompt includes: "RETTER FRA MENUEN:\nScrambled eggs\nAvocado toast\nCappuccino\n..."
   - AI writes caption mentioning items from the list

### Consistency:
- ✅ Same menu items used in idea generation and text generation
- ✅ Both read from `business_profile` (not `menu_results_v2` in FREE)
- ✅ Both limited to 5 items in FREE tier

### Current Limitation:
- AI idea might say "Vores focaccia er lækker"
- But if focaccia is not in the 5-item list, text generation might ignore it
- **Solution**: AI should use items from the 5-item list when creating menu_item ideas

---

## 🎯 SUMMARY

**What FREE users get:**

1. **Profile Data** (editable):
   - Business basics (name, sector, website)
   - Location (address, city, postal code)
   - Contact (phone, email, booking link)
   - About text
   - Opening hours
   - Menu highlights (read-only, 5 items)

2. **AI Ideas** (8 suggestions):
   - Based on: 5 menu items + weather + season + generic tone
   - Content types: menu_item, atmosphere, behind_scenes, seasonal
   - Cached for 24 hours

3. **Text Generation**:
   - GPT-4o-mini powered
   - 200-300 characters
   - CTA integration (AI selects from pool)
   - Deterministic hashtags
   - Uses 5 menu items from profile

**What PAID users get additionally:**
- Detailed AI-extracted menu (10+ items with descriptions + prices)
- Custom brand voice
- More menu items in AI context
- Editable menu in profile
- Advanced analytics (future)

**Key Takeaway:**
FREE tier uses **basic menu from website scan** (5 items, names only).
PAID tier uses **detailed AI-extracted menu** (10+ items, full descriptions + prices).

This properly gates the premium menu extraction feature! 🎯
