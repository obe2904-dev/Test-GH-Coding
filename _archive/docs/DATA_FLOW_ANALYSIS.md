# Data Flow Analysis: Business Profile & Menu Data

## Summary
Analysis of how business data (profile, menu, brand voice) flows through the system from database → AI functions → generated content.

## Issues Found

### 1. **CRITICAL: Incomplete Business Profile Sent to AI**
**Location:** [usePostCreationAI.ts](src/hooks/usePostCreationAI.ts#L400-L432)

**Problem:**
When creating a post, the system fetches businessProfile but **DOES NOT include menu_structure or menu_description**:

```typescript
// CURRENT CODE - Missing menu data!
businessProfile = {
  business_name: business.name,
  business_category: business.vertical,
  address: location?.city || null,
  opening_hours: null, // ❌ Not implemented
  keywords: profile?.keywords || null,
  country: location?.country ? location.country.trim() : null
  // ❌ Missing: menu_structure
  // ❌ Missing: menu_description
}
```

**Impact:** AI has no menu context when generating posts, even though menu data exists in database.

---

### 2. **Brand Profile Generator Was Looking at Wrong Table**
**Location:** [brand-profile-generator/index.ts](supabase/functions/brand-profile-generator/index.ts#L313)

**Problem:** ✅ **FIXED** - Was querying non-existent `menu_items` table instead of `business_profile.menu_structure`

**Fix Applied:**
```typescript
// Extract menu data from business_profile.menu_structure (JSONB field)
let menuItems: any[] = []
if (profileResult.data?.menu_structure) {
  // Parse and flatten menu structure
  menuItems = extracted items from categories
}
```

---

### 3. **Inconsistent Data Storage**

#### Menu Data Storage:
- **Correct location:** `business_profile.menu_structure` (JSONB)
- **Also used:** `business_profile.menu_description` (TEXT)
- **Old/unused:** `menu_items` table (doesn't exist)

#### Opening Hours Storage:
- **Correct location:** `opening_hours` table (normalized)
- **Also stored:** Can be fetched and assembled into JSON
- **Issue:** Not sent to AI functions

---

## Data Flow Map

### 1. Business Profile Page → Database
```
User Input
    ↓
BusinessProfilePage.tsx
    ↓
saveBusinessProfile()
    ↓
Database Tables:
- businesses (name, category, website_url)
- business_profile (menu_structure, menu_description, long_description)
- business_locations (address, city, country, phone, email)
- opening_hours (weekday schedules)
- business_brand_profile (brand_essence, tone_of_voice, etc.)
```

### 2. Post Creation → AI Enhancement
```
User creates post
    ↓
usePostCreationAI.ts
    ↓
Fetches business data:
✅ businesses.name, vertical
✅ business_locations.city, country
✅ profiles.keywords
❌ Missing: business_profile.menu_structure
❌ Missing: business_profile.menu_description
❌ Missing: opening_hours
    ↓
Sends to ai-enhance function
    ↓
ai-enhance receives incomplete businessProfile
    ↓
Generates content WITHOUT menu context
```

### 3. Brand Profile Generation
```
User clicks "Generate Brand Profile"
    ↓
brand-profile-generator function
    ↓
gatherDataSources()
    ↓
Fetches:
✅ businesses table
✅ business_profile.menu_structure (FIXED)
✅ website_analyses
✅ media_assets
✅ social_accounts
    ↓
Generates brand profile with menu data
```

---

## Required Fixes

### FIX #1: Add Menu Data to AI Enhancement Request (HIGH PRIORITY)

**File:** [usePostCreationAI.ts](src/hooks/usePostCreationAI.ts#L400-L432)

**Change needed:**
```typescript
if (business) {
  // Get location data
  const { data: location } = await supabase
    .from('business_locations')
    .select('postal_code, city, country')
    .eq('business_id', business.id)
    .maybeSingle()

  // 🆕 ADD THIS: Get business profile for menu data
  const { data: profile } = await supabase
    .from('business_profile')
    .select('menu_structure, menu_description')
    .eq('business_id', business.id)
    .maybeSingle()

  // Try to get keywords from profiles
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('keywords')
    .eq('id', user.id)
    .maybeSingle()

  businessProfile = {
    business_name: business.name,
    business_category: business.vertical,
    address: location?.city || null,
    opening_hours: null, // TODO: Fetch from opening_hours table
    keywords: userProfile?.keywords || null,
    country: location?.country ? location.country.trim() : null,
    // 🆕 ADD THESE:
    menu_structure: profile?.menu_structure || null,
    menu_description: profile?.menu_description || null
  }
}
```

### FIX #2: Add Opening Hours to Request (MEDIUM PRIORITY)

**Additional query needed:**
```typescript
const { data: hours } = await supabase
  .from('opening_hours')
  .select('*')
  .eq('business_id', business.id)

// Convert to weekday format
const openingHours = {}
hours?.forEach(h => {
  openingHours[h.weekday] = {
    open: h.open_time,
    close: h.close_time,
    closed: h.closed
  }
})

businessProfile.opening_hours = openingHours
```

### FIX #3: Add businessId to Request (HIGH PRIORITY)

**Why:** The ai-enhance function needs businessId to fetch brand_profile data

**Change:**
```typescript
body: JSON.stringify({
  text: currentContent.text,
  headline: currentContent.headline || '',
  platforms: availablePlatforms,
  includeEmojis,
  includeHashtags,
  userTier: currentTier,
  language,
  businessProfile,
  businessId: business.id, // 🆕 ADD THIS
  skipClarification: hasUsedClarification,
  hasPhoto,
  clarificationContext: clarificationInput || null
})
```

---

## Testing Checklist

After applying fixes:

### Test 1: Post Creation with Menu Data
1. ✅ Add menu items to Business Profile
2. ✅ Create a post mentioning "menu" or specific dish
3. ✅ Check if AI references actual menu items
4. ✅ Check logs for `hasMenuStructure: true`

### Test 2: Brand Profile Generation
1. ✅ Deploy updated brand-profile-generator function
2. ✅ Add menu to Business Profile
3. ✅ Generate Brand Profile
4. ✅ Verify Brand Essence mentions specific dishes/items
5. ✅ Check logs for "Extracted X menu items"

### Test 3: Brand Voice in Posts
1. ✅ Generate Brand Profile
2. ✅ Create a post
3. ✅ Check if post tone matches Brand Voice settings
4. ✅ Check logs for "Brand voice injected"

---

## Database Schema Reference

### Key Tables

#### `businesses`
```sql
- id (UUID)
- owner_id (UUID)
- name (TEXT)
- category (TEXT) -- Called 'vertical' in some queries
- website_url (TEXT)
```

#### `business_profile`
```sql
- business_id (UUID PRIMARY KEY)
- short_description (TEXT)
- long_description (TEXT)
- menu_description (TEXT)
- menu_structure (JSONB) -- ⭐ Critical for AI context
- target_audience (TEXT)
- price_level (TEXT)
```

#### `business_brand_profile`
```sql
- business_id (UUID PRIMARY KEY)
- brand_essence (TEXT)
- tone_of_voice (TEXT)
- things_to_avoid (TEXT)
- target_audience (TEXT)
- core_offerings (TEXT)
- content_focus (TEXT)
- cta_style (TEXT)
- communication_goal (TEXT)
- image_preferences (TEXT)
```

#### `business_locations`
```sql
- id (UUID)
- business_id (UUID)
- address_line1 (TEXT)
- postal_code (TEXT)
- city (TEXT)
- country (TEXT)
- phone (TEXT)
- email (TEXT)
- is_primary (BOOLEAN)
```

#### `opening_hours`
```sql
- id (UUID)
- business_id (UUID)
- weekday (TEXT) -- 'monday', 'tuesday', etc.
- open_time (TIME)
- close_time (TIME)
- closed (BOOLEAN)
```

---

## Next Steps

1. ✅ **Deploy brand-profile-generator fix** (already done)
2. ⏳ **Apply FIX #1** - Add menu_structure to post creation
3. ⏳ **Apply FIX #3** - Add businessId to request
4. ⏳ **Test post creation with menu data**
5. ⏳ **Test brand profile generation**
6. ⏳ **Apply FIX #2** - Add opening_hours (optional enhancement)
