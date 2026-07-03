# Menu Classification System

## Quick Suggestions Flow: Three-Stage Architecture

**Quick Suggestions are tactical same-day content** designed to drive footfall TODAY during active service periods. The system uses a three-stage flow to ensure quality and tactical relevance:

### Stage 1: Pre-Check Gate ✋
**Location:** `generation-window-validator.ts` → Called at entry point of `get-quick-suggestions/index.ts`

**Purpose:** Validate if Quick Suggestions should run at all

**Rules:**
- ✅ Valid window: 00:01 → (last service period end - 1.5 hours)
- ❌ Invalid: After cutoff → Direct user to "Skriv selv" (Write Yourself)
- ❌ Invalid: Business closed today
- ❌ Invalid: No hours configured

**Why This Matters:**
- Prevents wasteful AI calls for invalid time windows
- Customer journey buffer: Post → decide → travel → order ≈ 60-90 min
- Quick Suggestions must give customers time to ACT on the suggestion

**Example:**
```typescript
// Cafe Faust: Last service (BAR) ends at 01:00
// Cutoff: 01:00 - 1.5h = 23:30
// Valid: 00:01-23:29 ✅
// Invalid: 23:30-23:59 ❌ "For sent til hurtige forslag. Brug 'Skriv selv'..."
```

### Stage 2: Slot Calculation 📊
**Location:** `slot-calculator.ts` → Replaces complex `operational-timeline.ts` (250+ lines → 35 lines)

**Purpose:** Calculate how many suggestions to generate and when to post them

**Mathematical Formula:**
```typescript
available_hours = (last_service_end - 1.5h - current_time) / 60

if available_hours > 8:  slot_count = 3
elif available_hours >= 5: slot_count = 2
elif available_hours >= 2: slot_count = 1
else: slot_count = 1 (immediate only)
```

**Slot Timing Rules:**
1. **Strict minimum 2-hour spacing** between slots
2. **Service period transitions** - each slot targets different menu when possible
3. **Strategic framing:**
   - Slot 1: NOW - drive immediate footfall
   - Slot 2: PREVIEW - next service period teaser
   - Slot 3: LATE PREVIEW - evening/late service teaser

**Example (Cafe Faust at 07:00):**
```
Active: None (opens at 09:30)
Upcoming: BRUNCH (09:30-14:00), FROKOST (09:30-17:00), AFTENSMAD (17:00-21:30), BAR (21:30-01:00)
Available hours: 07:00 → 23:30 = 16.5 hours
Slot count: 16.5h > 8h → 3 slots

Slot 1: 09:30 (NOW - brunch opening)
Slot 2: 13:00 (PREVIEW - frokost rush hour)
Slot 3: 17:00 (PREVIEW - aftensmad service start)
```

**Edge Cases Handled:**
- ✅ **Midnight-crossing venues** (bar 21:00-02:00): Time normalized to 1500 mins
- ✅ **Social dead zone** (00:00-05:59): Generates slots for upcoming day, not current
- ✅ **Overlapping periods** (brunch + lunch active): All periods included in rotation queue
- ✅ **No programs**: Fallback to opening hours or single general slot

### Stage 3: Service Period Detection 🍽️
**Location:** `service-period-detector.ts` → Updated to support multi-period overlaps

**Purpose:** Find ALL currently active service periods (not just first match)

**NEW Behavior:**
```typescript
// OLD (BROKEN):
if current_time in window:
    return window.name  // Returns FIRST match only
    break  // ❌ Stops searching

// NEW (FIXED):
active_periods = []
for window in all_windows:
    if current_time in window:
        active_periods.append(window.name)  // Collects ALL matches
return active_periods  // ✅ Returns ['brunch', 'lunch'] for overlaps
```

**Example (Your Hybrid Venue at 10:00):**
```
Programs:
- BRUNCH: 09:30-14:00 ✅ Active (10:00 is within window)
- FROKOST: 09:30-17:00 ✅ Active (10:00 is within window)
- DINNER: 17:00-21:30 ❌ Not started yet
- BAR: 21:30-01:00 ❌ Not started yet

Result: currentPeriods = ['brunch', 'lunch']

Rotation queue fetches dishes tagged with EITHER brunch OR lunch
AI sees: "Aktive serviceperioder: BRUNCH (09:30-14:00) + FROKOST (09:30-17:00)"
```

### Stage 4: AI Generation 🤖
**Location:** Gemini API calls in `get-quick-suggestions/index.ts`

**Purpose:** Generate content with multi-period context and strategic timing

**Inputs (Paid Tier):**
```typescript
{
  activePrograms: [
    { name: "BRUNCH", start: "09:30", end: "14:00", hoursRemaining: 4 },
    { name: "FROKOST", start: "09:30", end: "17:00", hoursRemaining: 7 }
  ],
  upcomingPrograms: [
    { name: "AFTENSMAD", start: "17:00", end: "21:30", startsInHours: 7 }
  ],
  slots: [
    { 
      position: 1, 
      suggestedTime: "10:30",
      eligiblePeriods: ["brunch", "lunch"],
      rationale: "NOW - drive immediate footfall"
    },
    { 
      position: 2, 
      suggestedTime: "13:00",
      eligiblePeriods: ["lunch"],
      rationale: "PREVIEW - lunch rush window"
    },
    { 
      position: 3, 
      suggestedTime: "17:00",
      eligiblePeriods: ["dinner"],
      rationale: "PREVIEW - evening service teaser"
    }
  ]
}
```

**Confirmed Facts Include:**
- 🍽️ Aktive serviceperioder: BRUNCH (09:30-14:00) + FROKOST (09:30-17:00)
- Rotation priority from dishes tagged with brunch OR lunch
- Weather and current time context

**Prompt Structure:**
- Rationale priority: (a) Time window (service period > current time), (b) Choice reason (rotation > time match > weather > day context)
- Each slot has clear PURPOSE → stronger tactical framing

**Free Tier:** Simple key_offerings list, no service periods, no rationales

### Stage 5: Light Validation 🧹
**Location:** `output-validator.ts` → Fixed to preserve valid timing references

**Purpose:** Strip hallucinations only, preserve valid AI output

**What It Strips:**
- ❌ "i morgen" (tomorrow) references - Quick Suggestions are TODAY only
- ❌ Promotional urgency copy ("kun i dag", "book nu")
- ❌ Ingredient claims not in dish description
- ❌ Positive outdoor framing when weather is poor

**What It PRESERVES:**
- ✅ Valid service period times (e.g., "kl. 09:30", "serveres til kl. 14:00")
- ✅ Opening/closing time references from database
- ✅ Current time context

**Legacy Bug (FIXED):**
The old validator compared service period times against closing time using absolute difference, which broke for:
- Midnight-crossing venues (01:00 close < 09:30 open → stripped 09:30 ❌)
- Service periods ending before closing (brunch 14:00 vs close 01:00 → 690 min diff → stripped ❌)

**New Logic:**
"Service period times are CORRECT if Gemini mentions them - the pre-check gate already validated we're in a valid window."

---

## Implementation Summary

### Files Created/Modified

**NEW FILES:**
1. `slot-calculator.ts` (500 lines)
   - Hours-based slot count formula
   - Service period transition logic
   - Edge case handling (midnight-crossing, social dead zone)
   - Replaces `operational-timeline.ts` complexity

**MODIFIED FILES:**
2. `service-period-detector.ts`
   - Added `currentPeriods: ServicePeriod[]` (NEW array field)
   - Changed detection logic to find ALL active windows, not just first
   - Backward compatible (`currentPeriod` still exists)

3. `menu-rotation-queue.ts`
   - Added `servicePeriods?: string[]` option
   - Changed filtering logic to check overlap with ANY requested period
   - Backward compatible (`servicePeriod` still works)

4. `get-quick-suggestions/index.ts`
   - Uses `currentPeriods` array from detector
   - Passes multiple periods to rotation queue
   - Shows ALL active programs in confirmed facts
   - Updated logging for multi-period visibility

5. `generation-window-validator.ts` (already existed)
   - Pre-check gate implementation
   - No changes needed (already matches spec)

6. `output-validator.ts` (already fixed)
   - Light validation preserving valid times
   - No changes needed (already matches spec)

### Code Reduction

- **Before:** operational-timeline.ts (250+ lines) + complex state machine
- **After:** slot-calculator.ts (500 lines total, but includes all edge cases explicitly)
- **Net:** Simpler logic, easier to test, clearer purpose

### Test Cases

**Test Case 1a (Your Spec): 07:00 Generation**
```
Time: 07:00
Available: 16.5 hours (07:00 → 23:30)
Slot count: 3 slots ✅
Slots: 09:30 (brunch), 13:00 (frokost), 17:00 (aftensmad) ✅
Spacing: 6h, 4h (both > 2h minimum) ✅
```

**Test Case 1b (Your Spec): 13:00 Generation**
```
Time: 13:00
Active: FROKOST (09:30-17:00) ✅
Upcoming: AFTENSMAD (17:00-21:30), BAR (21:30-01:00) ✅
Available: 10.5 hours (13:00 → 23:30)
Slot count: 3 slots ✅
Slots: 13:30 (frokost NOW), 17:00 (aftensmad PREVIEW), 20:00 (bar LATE) ✅
```

**Test Case 2 (Overlapping Periods): 10:00 Generation**
```
Time: 10:00
Active: BRUNCH (09:30-14:00), FROKOST (09:30-17:00) ✅ BOTH
Rotation queue: Dishes tagged with 'brunch' OR 'lunch' ✅
Confirmed facts: "Aktive serviceperioder: BRUNCH + FROKOST" ✅
```

**Test Case 3 (Midnight-Crossing): 23:00 at Bar**
```
Time: 23:00
Active: BAR (21:30-01:00)
Normalized: 23:00 = 1380 mins, close = 1500 mins (01:00 + 1440)
Cutoff: 1500 - 90 = 1410 mins = 23:30
Valid: 23:00 < 23:30 ✅ (30 min window remaining)
Slot count: 1 (< 2h available)
Slot: 23:30 (bar/drinks content) ✅
```

**Test Case 4 (Social Dead Zone): 02:00 Generation**
```
Time: 02:00
Social dead zone detected ✅
Shifts to upcoming day:
  First service: BRUNCH 09:30
  Available: 09:30 → 23:30 = 14 hours
  Slot count: 3
Slots: 09:30, 13:30, 18:00 (for upcoming day) ✅
```

---

## Scope: Paid Tiers Only

**This classification system applies to Smart (standardplus) and Pro (premium) tiers only.**

**Free tier does NOT use this system:**
- Uses `business_profile.key_offerings` (simple dish name list entered during onboarding)
- No menu extraction, no `menu_results_v2`, no `menu_items_normalized`
- No service period classification or rotation tracking
- No UUID chain, no ingredient details
- Quick Suggestions show dish names only (no rationales, no service period context)

---

## Overview

The system automatically classifies restaurant menus into service periods (brunch, lunch, dinner, bar) using a multi-stage detection pipeline that combines AI extraction, time-based inference, and title pattern matching.

**Storage**: Each menu extraction gets a unique UUID stored in `menu_results_v2`. See [Menu Storage & Unique Identifiers](#menu-storage--unique-identifiers) for detailed schema and data relationships.

**UUID Chain Tracking**: The system maintains complete traceability from menu extraction → content suggestions → published posts. See [UUID Chain Tracking System](#uuid-chain-tracking-system) for rotation tracking, analytics, and variant distinction (e.g., lunch vs dinner FAUSTBURGER).

---

## Menu Storage & Unique Identifiers

### Unique Menu IDs

Every menu extraction gets a **unique UUID** that tracks it through the entire system:

**Primary Table: `menu_results_v2`**
- `id` (UUID) - Unique identifier for each extraction job
- `source_id` (UUID) - References `menu_sources.id` (which menu source this belongs to)
- `business_id` (UUID) - Which business this menu belongs to

**Example:**
```typescript
// When you extract a menu:
const resultId = '298af44f-c918-4218-afa1-af2b5f4d3af0'  // Unique extraction ID

// This links to:
const sourceId = '2388abff-7c36-4860-8b11-6ec08dd77b3b'  // menu_sources.id
```

### Data Storage Structure

#### Table 1: `menu_results_v2` (Extraction Results)
**Purpose**: Stores complete extracted menu data and classification metadata

**Key Columns:**
```sql
CREATE TABLE menu_results_v2 (
  -- Identifiers
  id                      UUID PRIMARY KEY,           -- Unique extraction ID
  business_id             UUID NOT NULL,              -- Business reference
  source_id               UUID REFERENCES menu_sources(id),  -- Menu source reference
  
  -- Source Info
  source_kind             TEXT NOT NULL,              -- 'url' or 'storage'
  source_url              TEXT,                       -- Menu webpage URL
  source_content_type     TEXT,                       -- 'text/html', 'application/pdf'
  
  -- Processing Status
  status                  TEXT NOT NULL,              -- 'queued', 'processing', 'done', 'error'
  language_code           TEXT DEFAULT 'da',          -- AI-detected language
  extraction_method       TEXT,                       -- 'edge_html', 'edge_pdf', 'cloudrun_pdf_ocr'
  attempts                INTEGER DEFAULT 0,
  claimed_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  
  -- Classification Metadata (✨ CORE SYSTEM OUTPUT)
  service_periods         TEXT[],                     -- ['brunch', 'lunch', 'dinner', 'bar']
  service_period_name     TEXT,                       -- Primary period (e.g., 'brunch')
  is_signature            BOOLEAN DEFAULT false,      -- Special/signature menu
  availability_days       TEXT,                       -- Day restrictions (e.g., 'onsdag-lørdag')
  
  -- Extracted Data
  raw_text                TEXT,                       -- Cleaned HTML text (HTML only)
  structured_data         JSONB,                      -- Full menu structure (categories, items, timing)
  ai_summary              TEXT,                       -- AI-generated menu summary
  representative_dishes   JSONB,                      -- 1-3 signature dishes for voice generation
  
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

**Example Row:**
```json
{
  "id": "298af44f-c918-4218-afa1-af2b5f4d3af0",
  "business_id": "f4679fa9-3120-4a59-9506-d059b010c34a",
  "source_id": "2388abff-7c36-4860-8b11-6ec08dd77b3b",
  "source_url": "https://cafefaust.dk/menukort/brunch/",
  "status": "done",
  "language_code": "da",
  "service_periods": ["brunch"],
  "service_period_name": "brunch",
  "is_signature": false,
  "structured_data": {
    "menuTitle": "BRUNCH",
    "categories": [
      {
        "name": "BRUNCH",
        "items": [
          {
            "name": "FAUSTBURGER",
            "description": "med Angus hakkebøf, ost...",
            "price": "199",
            "currency": "DKK"
          }
        ]
      }
    ],
    "menuPeriods": [
      {
        "name": "BRUNCH",
        "startTime": "09:00",
        "endTime": "14:00",
        "type": "brunch"
      }
    ]
  }
}
```
