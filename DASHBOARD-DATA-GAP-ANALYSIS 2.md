# Dashboard UI vs Content Generation: Gap Analysis
**Comprehensive Review of Data Collection, Usage, and Value Assessment**

> **Purpose**: This document analyzes what data is collected in the dashboard UI, what is actually used in content generation, identifies gaps, and assesses the value contribution of each data point.

---

## Executive Summary

### Key Findings

1. **High-Value Data Fully Utilized** ✅
   - Menu data, Brand Profile, Location Intelligence, Opening Hours
   - All critical for content generation
   - Well-integrated from UI to AI prompts

2. **Collected But Underutilized** ⚠️
   - Business Character (AI-generated descriptor)
   - Owner Differentiator (removed field)
   - Weekly Programme (collected but not yet used strategically)
   - Kitchen Close Time (collected but not factored into timing)

3. **Missing from UI** ❌
   - Programme rotation priorities (backend-only)
   - Revenue weights for programmes (not implemented)
   - Post length guidelines (UI exists but backend save not implemented)

4. **Data Quality Issues** 🔧
   - Menu highlights extraction has multiple fallback paths (signatureItems → menuCategories → menu_structure)
   - Opening hours data redundancy (stored in both UI state and database)
   - Price level stored but not editable in UI

---

## Dashboard Page Analysis

### 1. Profile Page (`/dashboard/profile`)
**Component**: `BusinessProfilePage.tsx`

#### **Data Collected in UI**

| Field | Database Table | Column | Editable | Value to Content Generation |
|-------|---------------|--------|----------|----------------------------|
| **Business Name** | businesses | name | ✅ | **CRITICAL** - Used in all prompts as business identity |
| **Website URL** | businesses | website_url | ✅ | **HIGH** - Source for menu/brand analysis |
| **Business Category** | businesses | vertical | ✅ | **HIGH** - Determines framework (hospitality vs retail) |
| **Tagline** | business_profile | short_description | ✅ | **MEDIUM** - Used in brand context |
| **About Text** | business_profile | long_description | ✅ | **MEDIUM** - Used in brand essence derivation |
| **Phone** | business_locations | phone | ✅ | **LOW** - Display only, not used in prompts |
| **Email** | business_locations | email | ✅ | **LOW** - Display only, not used in prompts |
| **Address** | business_locations | address_line1 | ✅ | **CRITICAL** - Used for location analysis, weather API |
| **Postal Code** | business_locations | postal_code | ✅ | **MEDIUM** - Geographic context |
| **City** | business_locations | city | ✅ | **CRITICAL** - Weather API lookup, contextual calendar |
| **Country** | business_locations | country | ✅ | **CRITICAL** - Season context, event filtering |
| **Booking Link** | business_brand_profile | booking_link | ✅ | **MEDIUM** - CTA in post generation |
| **Logo URL** | businesses | logo_url | ✅ | **LOW** - Display only |
| **Menu Highlights** | business_profile | menu_signal | ❌ Read-only | **HIGH** - Quick menu overview for Free tier |
| **Opening Hours** | opening_hours | weekday, open_time, close_time | ✅ | **CRITICAL** - Filters posting days, time constraints |
| **Business Character** | business_brand_profile | business_character | ❌ AI-generated | **MEDIUM** - Hybrid type descriptor (e.g., "café-bar hybrid") |
| **Service Model Flags** | business_operations | has_table_service, has_takeaway, has_delivery, has_outdoor_seating, has_wifi, has_power_outlets, has_parking, reservation_required, has_kids_menu | ✅ | **HIGH** - Service model context, outdoor weather gates |
| **Kitchen Close Time** | business_operations | kitchen_close_time | ✅ | **LOW** - Collected but NOT used in time suggestions |
| **Weekly Programme** | business_operations | weekly_programme | ✅ | **MEDIUM** - Free text, not structured (should be dropdown) |

#### **Gap Analysis**

**✅ Fully Utilized**:
- Business name, address, city, country, opening hours
- Service model flags (outdoor seating critical for weather gates)
- Menu highlights (Free tier fallback)

**⚠️ Collected But Underutilized**:
- **Business Character**: AI-generated free text (e.g., "Moderne café med fokus på specialkaffe og hjemmelavet mad") stored but not injected into content generation prompts
- **Kitchen Close Time**: Collected but ignored in time suggestions (only uses general close_time)
- **Weekly Programme**: Free text field (e.g., "Brunch weekend, Frokost hverdage") but not parsed or used strategically

**❌ Missing**:
- **Price Level**: Stored in business_operations.price_level but NOT editable in UI (should have dropdown: Budget, Mid, Premium)
- **Revenue Weights**: Programme revenue priorities not editable (future feature per HYBRID-PROGRAMME-ROTATION-PLAN.md)

**🔧 Data Quality Issues**:
- Menu highlights has 3 fallback extraction paths (signatureItems → menuCategories → menu_structure) indicating data source inconsistency
- Opening hours duplicated in UI state and database (could cause sync issues)

---

### 2. Menu Page (`/dashboard/menu`)
**Component**: `MenuPage.tsx`

#### **Data Collected in UI**

| Field | Database Table | Column | Editable | Value to Content Generation |
|-------|---------------|--------|----------|----------------------------|
| **Menu Source URLs** | menu_sources | source_url, menu_type, label | ✅ | **CRITICAL** - Menu extraction source |
| **Extracted Menu Data** | menu_results_v2 | structured_data | ❌ AI-extracted | **CRITICAL** - Dish names, descriptions, categories, prices |
| **AI Menu Summary** | menu_results_v2 | ai_summary | ❌ AI-generated | **HIGH** - Helicopter view for Phase 0 occasion selection |
| **Service Periods** | menu_results_v2 | service_periods | ❌ Detected | **HIGH** - Programme detection (Brunch, Frokost, Aftensmad) |
| **Cuisine Style** | menu_results_v2 | cuisine_style | ❌ Detected | **MEDIUM** - Used in brand profile and content tone |
| **Is Signature** | menu_results_v2 | is_signature | ✅ Toggle | **HIGH** - Item prioritization in post selection |
| **Is Seasonal** | menu_items_normalized | is_seasonal | ✅ Toggle | **MEDIUM** - Boosts priority in matching season |
| **Is Limited Time** | menu_items_normalized | is_limited_time | ✅ Toggle | **HIGH** - Always prioritized in suggestions |
| **Social Lead Flag** | menu_sources | is_social_lead | ✅ | **MEDIUM** - Marks which menu drives content (e.g., dinner menu vs drinks) |
| **Price Level** | business_operations | price_level | ❌ Derived from menu | **MEDIUM** - Language register calibration (budget vs premium) |

#### **Gap Analysis**

**✅ Fully Utilized**:
- Structured menu data flows directly to Weekly Plan and Dagens Forslag
- AI summaries used in Phase 0 for posting occasion selection
- Service periods used for programme-based content rotation
- Item flags (signature, seasonal, limited_time) properly prioritized

**⚠️ Collected But Underutilized**:
- **Social Lead Flag**: UI allows marking one menu as primary for social content, but this flag is NOT read in content generation (should boost that menu's items in suggestion priority)

**❌ Missing**:
- **Programme Revenue Weights**: No UI for setting revenue priority per programme (e.g., "Dinner contributes 40% revenue, Cocktails 5%"). This is collected in backend for rotation scoring but not editable.
- **Dish Blocklist**: No UI to manually exclude specific dishes from content generation (e.g., "Don't suggest kids menu items")

**🔧 Data Quality Issues**:
- Menu extraction has category-level blocklists (børnemenu, tilvalg) hardcoded in backend — should be configurable in UI
- Price level derived from menu averages but not editable (what if user wants to position as premium despite budget prices?)

---

### 3. Location Page (`/dashboard/location`)
**Component**: `LocationIntelligencePage.tsx`

#### **Data Collected in UI**

| Field | Database Table | Column | Editable | Value to Content Generation |
|-------|---------------|--------|----------|----------------------------|
| **Address** | business_locations | address_line1 | ✅ | **CRITICAL** - Location analysis input |
| **Neighborhood** | business_location_intelligence | neighborhood | ❌ AI-derived | **HIGH** - Audience context |
| **Area Type** | business_location_intelligence | area_type | ❌ AI-derived | **HIGH** - Primary location category (waterfront, city_centre, etc.) |
| **Category Scores** | business_location_intelligence | category_scores | ❌ AI-derived | **CRITICAL** - Multi-dimensional location types (tourist, office, shopping) |
| **Location Marketing Hooks** | business_location_intelligence | location_marketing_hooks | ❌ AI-derived | **HIGH** - Strategic messaging angles |
| **Latitude/Longitude** | business_location_intelligence | latitude, longitude | ❌ Geocoded | **CRITICAL** - Weather API coordinates |
| **Landmarks Nearby** | business_location_intelligence | landmarks_nearby | ❌ AI-detected | **MEDIUM** - Cultural context |
| **Neighborhood Character** | business_location_intelligence | neighborhood_character | ❌ AI-generated | **MEDIUM** - Descriptive context |
| **Concept Fit** | business_location_intelligence | concept_fit_by_category | ❌ AI-calculated | **HIGH** - Location-business alignment scores |

#### **Gap Analysis**

**✅ Fully Utilized**:
- Category scores used for audience framework derivation
- Coordinates used for weather API (7-day forecast)
- Neighborhood context flows into content generation

**⚠️ Collected But Underutilized**:
- **Location Marketing Hooks**: AI generates hooks like "Waterfront destination dining" but these are NOT explicitly injected into content generation prompts (should be in weekContext.location_intelligence)
- **Concept Fit**: Per-category fit scores calculated but NOT used to filter suggested content types (e.g., if "office" fit is low, don't suggest lunch posts)

**❌ Missing**:
- **Manual Location Type Override**: No UI to manually adjust location types if AI misclassifies (e.g., AI says "tourist" but owner knows it's "neighborhood local")
- **Seasonal Relevance**: Location types have SEASONAL_PATTERN_MAP in code (waterfront = summer_peak) but this is NOT surfaced in UI or used in content scheduling

**🔧 Data Quality Issues**:
- Location analysis is re-run on every page load if address changes (expensive) — should cache and only re-run on explicit "Analyze" button click
- Dual location contexts (e.g., Café Faust: Waterfront + City Centre) are stored but NOT meaningfully combined in audience interpretation (HYBRID-PROGRAMME-ROTATION-PLAN.md notes this issue)

---

### 4. Brand Page (`/dashboard/brand`)
**Component**: `BrandProfilePageV5.tsx`, `BrandProfileDisplay.tsx`

#### **Data Collected in UI**

| Field | Database Table | Column | Editable | Value to Content Generation |
|-------|---------------|--------|----------|----------------------------|
| **Brand Essence** | business_brand_profile | brand_essence | ❌ AI-generated | **CRITICAL** - Core identity in all prompts |
| **Brand Essence Elaboration** | business_brand_profile | brand_essence_elaboration | ❌ AI-generated | **HIGH** - Extended brand narrative |
| **Tone of Voice (Rules)** | business_brand_profile | tone_of_voice | ❌ AI-generated | **CRITICAL** - "Skriv sådan her" block |
| **Tone Model (Structured)** | business_brand_profile | tone_model | ❌ AI-generated | **HIGH** - Formality, sentence style, address form |
| **Content Hooks** | business_brand_profile | content_focus | ❌ AI-generated | **HIGH** - Strategic content themes |
| **Target Audience** | business_brand_profile | target_audience | ❌ AI-generated | **HIGH** - Audience characteristics |
| **Signature Phrases** | business_brand_profile | signature_phrases | ❌ AI-generated | **HIGH** - Brand vocabulary |
| **Never Say** | business_brand_profile | never_say | ❌ AI-generated | **HIGH** - Banned words/phrases |
| **Typical Openings** | business_brand_profile | typical_openings | ❌ AI-generated | **MEDIUM** - Post opening templates |
| **Typical Closings** | business_brand_profile | typical_closings | ❌ AI-generated | **MEDIUM** - Post closing templates (+ banned closers in post-process.ts) |
| **Humor Level** | business_brand_profile | humor_level | ❌ AI-generated | **MEDIUM** - Tone calibration |
| **Content Strategy** | business_brand_profile | content_strategy | ❌ AI-generated | **CRITICAL** - Goal blend, content category weights |
| **Voice Archetype** | business_brand_profile | voice_archetype | ✅ Editable dropdown | **CRITICAL** - Primary voice persona (warm_local, authentic_craftsmanship, etc.) |
| **Voice System** | business_brand_profile | voice_system | ❌ AI-generated | **HIGH** - Programme-specific voice variations |
| **Posting Occasions** | business_brand_profile | posting_occasions | ❌ AI-selected | **HIGH** - Content type selection (brunch_moments, afterwork_drinks) |
| **Audience Framework** | business_brand_profile | audience_framework | ❌ AI-generated | **CRITICAL** - Time slots with programmes, audiences, contexts |
| **Brand Context** | business_brand_profile | brand_context | ❌ AI-generated | **HIGH** - Origin story, differentiator, local landmarks |
| **Identity Keywords** | business_brand_profile | identity_keywords | ❌ AI-generated | **MEDIUM** - Brand keyword vocabulary |
| **Voice Constraints** | business_brand_profile | voice_constraints | ❌ AI-generated | **MEDIUM** - Voice boundaries |
| **Voice Rationale** | business_brand_profile | voice_rationale | ❌ AI-generated | **MEDIUM** - Explanation of voice choices |
| **Post Length Guidelines** | UI component only | N/A | ✅ Editable (UI only) | **MEDIUM** - Content type length recommendations (NOT saved to backend) |

#### **Gap Analysis**

**✅ Fully Utilized**:
- Brand essence, tone model, content strategy all flow to AI prompts
- Audience framework (timeSlots with programmes) drives content rotation
- Voice system enables programme-specific tone variations
- Never say list enforced in post-process.ts

**⚠️ Collected But Underutilized**:
- **Brand Context (Origin Story, Differentiator)**: AI generates this but it's NOT injected into content generation prompts (should add emotional depth to posts)
- **Voice Rationale**: Explains why specific voice was chosen, but this meta-reasoning is NOT used in generation (could inform edge cases)
- **Identity Keywords**: Generated but not explicitly weighted in content selection

**❌ Missing**:
- **Post Length Guidelines**: UI component exists (PostLengthGuidelines.tsx) with editable fields for 5 content types, but backend save handler NOT implemented (TODO comment in code)
- **Programme Revenue Priorities**: No UI to adjust revenue weights per programme (mentioned in HYBRID-PROGRAMME-ROTATION-PLAN.md Phase 4)
- **Manual Audience Override**: Cannot manually edit audience segments per time slot (all AI-generated)

**🔧 Data Quality Issues**:
- Voice Archetype is the ONLY editable field in brand profile — rest is read-only AI output (should allow manual refinement)
- Audience Framework timeSlots lost the `label` field (simplified to programmes-only) but UI client-side derives labels from programme names — fragile
- Typical Closings stored in brand profile but "Svip forbi" ban is hardcoded in post-process.ts (should centralize in never_say list)

---

## Cross-Cutting Themes

### 1. Programme Rotation Data Flow

**Backend Collection** (WORKS):
- `audience_framework.timeSlots[].programmes` extracted from brand profile
- `generated_posts` table tracks last 4 weeks of posts with `metadata.programme`
- `calculateProgrammePriorities()` scores programmes by recency, frequency, revenue

**UI Visibility** (MISSING):
- No dashboard page shows programme coverage over time
- No UI to view underrepresented programmes
- No UI to set revenue weights per programme

**Recommendation**: Add Programme Analytics panel to Dashboard showing:
- Posts per programme (last 4 weeks)
- Days since last mention
- Coverage balance vs target distribution

---

### 2. Weather Integration

**Backend Collection** (WORKS):
- Coordinates from `business_location_intelligence.latitude/longitude`
- OpenWeatherMap API: 7-day forecast for Weekly Plan, current + 24h for Dagens Forslag
- Outdoor suitability gate: `temp ≥ 15°C AND wind < 5 m/s AND outdoor_seating = true`

**UI Visibility** (MISSING):
- Location page shows coordinates but not weather forecast
- No preview of "Will outdoor suggestions be enabled this week?"
- No explanation of why outdoor suggestions are blocked

**Recommendation**: Add Weather Preview widget to Dashboard showing:
- This week's forecast with outdoor suitability flags
- "Outdoor suggestions enabled: 3/7 days this week"

---

### 3. Historical Data Deduplication

**Backend Collection** (WORKS):
- `weekly_content_plans` (last 14 days) → avoid repeating dishes
- `weekly_strategies` (last 6 weeks) → rotation patterns, selection preferences
- `generated_posts` (last 4 weeks) → programme coverage

**UI Visibility** (MISSING):
- No dashboard view of "Recently suggested dishes"
- No visibility into selection patterns (which goal_mode was preferred)
- No explanation of why certain dishes are blocked

**Recommendation**: Add Content History panel showing:
- Recently suggested dishes (last 2 weeks) with "blocked from this week" badge
- Selection patterns: "You selected 'build_brand' 60% of the time"

---

### 4. Price Level Calibration

**Backend Collection** (WORKS):
- Derived from menu_results_v2 average price
- Mapped to register: Budget (<80 DKK), Mid (80-150), Premium (>150)
- Used to adjust language formality in prompts

**UI Visibility** (PARTIAL):
- Menu page shows average price per menu card
- NO UI to manually override price level positioning
- NO explanation of how price affects content tone

**Recommendation**: Add Price Level selector to Profile page:
- Dropdown: Budget / Mid / Premium
- Explanation: "Affects language formality and dish descriptions"
- Auto-suggest based on menu average but allow manual override

---

## Value Assessment Matrix

| Data Point | Collection Effort | Generation Impact | Current Status | Recommendation |
|------------|------------------|------------------|----------------|----------------|
| **Business Name** | Low (manual) | CRITICAL | ✅ Used | Keep as-is |
| **Address/City** | Low (manual) | CRITICAL | ✅ Used | Keep as-is |
| **Opening Hours** | Medium (manual entry) | CRITICAL | ✅ Used | Keep as-is |
| **Menu Data** | High (AI extraction) | CRITICAL | ✅ Used | Keep as-is |
| **Brand Profile** | High (AI generation) | CRITICAL | ✅ Used | Add manual editing |
| **Location Intelligence** | High (AI analysis) | CRITICAL | ✅ Used | Cache to reduce cost |
| **Service Model Flags** | Low (checkboxes) | HIGH | ✅ Used | Keep as-is |
| **Weather Data** | None (API) | HIGH | ✅ Used | Add preview widget |
| **Contextual Events** | None (table) | HIGH | ✅ Used | Keep as-is |
| **Programme Rotation** | None (calculated) | HIGH | ✅ Used | Add analytics panel |
| **Price Level** | None (derived) | MEDIUM | ⚠️ Not editable | Add manual override |
| **Business Character** | High (AI) | MEDIUM | ❌ Not used | Inject into prompts |
| **Kitchen Close Time** | Low (manual) | LOW | ❌ Not used | Use or remove field |
| **Weekly Programme** | Low (manual) | MEDIUM | ⚠️ Free text | Convert to structured |
| **Post Length Guidelines** | Low (manual) | MEDIUM | ❌ Not saved | Implement save handler |
| **Revenue Weights** | None | HIGH (future) | ❌ Not implemented | Build UI + logic |

---

## High-Impact Improvements

### Priority 1: Close Data Gaps (Quick Wins)

1. **Implement Post Length Guidelines Save** (2 hours)
   - Add backend handler to save to `business_brand_profile.post_length_guidelines`
   - Already has UI component (PostLengthGuidelines.tsx)
   - **Value**: Enables brand-specific content length preferences

2. **Add Price Level Manual Override** (4 hours)
   - Add dropdown to Profile page: Budget / Mid / Premium
   - Store in `business_operations.price_level`
   - **Value**: Fixes cases where menu price doesn't match brand positioning

3. **Use Business Character in Prompts** (2 hours)
   - Inject `business_character` into weekContext.brand_voice
   - **Value**: Adds nuanced hybrid type context (e.g., "café-bar fusion")

4. **Use Kitchen Close Time** (3 hours)
   - Factor into time suggestions: never suggest posts within 30 min of kitchen close
   - **Value**: Prevents suggesting dinner posts when kitchen is closed

### Priority 2: Add Data Visibility (Medium Effort)

5. **Programme Coverage Analytics** (8 hours)
   - Dashboard widget showing posts per programme (last 4 weeks)
   - Visual bar chart of coverage distribution
   - **Value**: Transparency into rotation effectiveness

6. **Weather Forecast Preview** (6 hours)
   - Widget on Dashboard showing this week's outdoor suitability
   - **Value**: User understands why outdoor suggestions enabled/disabled

7. **Recently Suggested Dishes** (6 hours)
   - Panel showing blocked dishes from last 2 weeks
   - **Value**: Explains why certain dishes aren't appearing

### Priority 3: Strategic Enhancements (High Effort)

8. **Revenue Weights UI** (16 hours)
   - Programme priority sliders in Brand page
   - Backend integration with `calculateProgrammePriorities()`
   - **Value**: User control over content rotation priorities

9. **Manual Location Type Override** (12 hours)
   - Location page: checkboxes to add/remove location types
   - Override AI classification errors
   - **Value**: Fixes misclassification issues

10. **Seasonal Relevance Calendar** (20 hours)
    - Visual calendar showing when each programme is most relevant
    - Auto-adjust content rotation by season
    - **Value**: Seasonal content optimization

---

## Unused Data: Remove or Activate

### Fields to Remove (Low Value, Not Used)

1. **Weekly Programme** (free text)
   - Current: Free text field "Brunch weekend, Frokost hverdage"
   - Problem: Not parsed or used in generation
   - **Action**: Remove field OR convert to structured dropdown (Brunch, Frokost, Aftensmad, Cocktails) linked to audience_framework.timeSlots

2. **Phone & Email** (Profile page)
   - Current: Collected but only displayed, never used in content
   - **Action**: Remove from UI or add to business address block in posts (low priority)

### Fields to Activate (High Potential Value)

1. **Location Marketing Hooks**
   - Current: AI-generated but not used
   - **Action**: Add to weekContext.location_intelligence, inject into Phase 1 strategic brief

2. **Brand Context (Origin Story)**
   - Current: AI-generated but not used
   - **Action**: Inject into content generation prompts for emotional depth

3. **Social Lead Flag** (Menu)
   - Current: UI toggle exists but not read in generation
   - **Action**: Boost item priority when menu is marked as social lead

---

## Recommendations Summary

### Immediate Actions (This Sprint)
1. ✅ Implement Post Length Guidelines save handler
2. ✅ Add Price Level manual override dropdown
3. ✅ Inject Business Character into content prompts
4. ✅ Use Kitchen Close Time in time suggestions

### Next Quarter
5. ✅ Build Programme Coverage Analytics widget
6. ✅ Add Weather Forecast preview to Dashboard
7. ✅ Show Recently Suggested Dishes panel
8. ✅ Implement Revenue Weights UI (Phase 4 of rotation plan)

### Long-Term (Future Roadmap)
9. Manual Location Type override UI
10. Seasonal Relevance calendar and auto-rotation
11. Manual Brand Profile refinement (make more fields editable)
12. Dish blocklist UI (exclude specific items from suggestions)

---

## Conclusion

**Overall System Health**: ✅ Strong

The dashboard collects the right data and 80% of it flows correctly into content generation. The main gaps are:

1. **UI Visibility**: Backend systems work well but users can't see what's happening (programme coverage, weather suitability, dish deduplication)
2. **Manual Overrides**: Too much AI generation with no manual editing (price level, location types, brand profile fields)
3. **Incomplete Features**: Post length guidelines UI exists but backend save missing

**High-Value Quick Wins**: Implementing the 4 Priority 1 improvements will close critical gaps with minimal effort (11 hours total).

**Last Updated**: 1. maj 2026
**Next Review**: After Priority 1 implementations
