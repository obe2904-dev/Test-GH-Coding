# Menu Timing System

## Overview

We now have structured menu timing data that allows AI to intelligently suggest menu items based on time of day. The system parses menu categories with time ranges and makes them available for:

1. **Concept Fit Analysis** - Better timing evaluation (e.g., "Has lunch menu during office hours")
2. **AI Content Generation** - Time-appropriate menu suggestions (e.g., "Suggest something for 1 PM" → finds lunch menu → selects items)
3. **Marketing Optimization** - Target content to active menu periods

## Architecture

### 1. Data Structure

**MenuPeriod Interface** (in `conceptFitAnalyzer.ts`):
```typescript
interface MenuPeriod {
  name: string;              // "Brunch", "Lunch", "Dinner"
  type: 'breakfast' | 'brunch' | 'lunch' | 'afternoon' | 'dinner' | 'late_night' | 'all_day' | 'other';
  startTime: string;         // "09:00"
  endTime: string;           // "14:00"
  daysAvailable?: string[];  // ['monday', 'tuesday'] - optional
  items?: string[];          // Sample items for AI reference
}
```

**ConceptFitInput** now accepts:
```typescript
interface ConceptFitInput {
  // ... existing fields
  menuPeriods?: MenuPeriod[];  // NEW - structured timing data
  menuSummary?: string;        // DEPRECATED - use menuPeriods
}
```

### 2. Parsing Menu Data

**Location**: `src/lib/menu/menuPeriodParser.ts`

**Main Functions**:

```typescript
// Parse menu categories into structured periods
parseMenuPeriods(menuCategories: MenuCategory[]): MenuPeriod[]

// Find which menu is active at a specific time
findMenuForTime(time: string, periods: MenuPeriod[]): MenuPeriod | null

// Get human-readable description
getMenuPeriodDescription(period: MenuPeriod): string
```

**Parsing Logic**:
- Extracts time ranges from category names:
  - "BRUNCH 09.00-14.00" → startTime: "09:00", endTime: "14:00"
  - "Lunch (11:30-15:00)" → startTime: "11:30", endTime: "15:00"
  - "Frokost kl. 11-15" → startTime: "11:00", endTime: "15:00"
- Infers menu type from name keywords
- Falls back to sensible defaults if no time found

### 3. Integration with Concept Fit Analysis

**Enhanced Hours Fit Evaluation**:

The analyzer now checks both opening hours AND menu availability:

```typescript
// Office location example:
// ✅ Open 11:30-14:00 for lunch
// ✅ Has lunch menu 11:30-15:00
// → Score: "good" - "Perfekt match: Frokostmenu i kontorets rytme"

// Without menu timing:
// ✅ Open 11:30-14:00 for lunch
// ❓ Menu unknown
// → Score: "good" - "Godt match for kontorets rytme"
```

**Benefits**:
- More accurate fit scoring
- Better marketing guidance
- Identifies timing mismatches

## Usage Guide

### For Full-Service Establishments (FSE)

FSE businesses typically have multiple menu periods (Brunch, Lunch, Dinner). Parse and use them:

```typescript
import { parseMenuPeriods } from '@/lib/menu/menuPeriodParser';
import { analyzeConceptFit } from '@/lib/location/conceptFitAnalyzer';

// Your extracted menu data
const menuCategories = [
  { name: "BRUNCH 09.00-14.00", items: ["Æggekage", "Pandekager"] },
  { name: "FROKOST 11.30-15.00", items: ["Smørrebrød", "Salat"] },
  { name: "AFTEN 17.00-22.00", items: ["Bøf", "Fisk"] }
];

// Parse into structured periods
const menuPeriods = parseMenuPeriods(menuCategories);
// Result:
// [
//   { name: "BRUNCH", type: "brunch", startTime: "09:00", endTime: "14:00", items: [...] },
//   { name: "FROKOST", type: "lunch", startTime: "11:30", endTime: "15:00", items: [...] },
//   { name: "AFTEN", type: "dinner", startTime: "17:00", endTime: "22:00", items: [...] }
// ]

// Use in concept fit analysis
const conceptFits = analyzeConceptFit(
  categories,
  {
    openingHours: hours,
    menuPeriods: menuPeriods,  // ← NEW
    serviceModel: 'dine-in',
    priceLevel: 'mid'
  }
);
```

### For Specialized Beverage Outlets (SBO)

SBO businesses might have "All Day" menus or simple categories without time ranges:

```typescript
const menuCategories = [
  { name: "Coffee", items: ["Espresso", "Cappuccino"] },
  { name: "Small Bites", items: ["Croissant", "Bagel"] }
];

// Parser will infer types and default times
const menuPeriods = parseMenuPeriods(menuCategories);
// Result:
// [
//   { name: "Coffee", type: "other", startTime: "00:00", endTime: "23:59", items: [...] },
//   { name: "Small Bites", type: "other", startTime: "00:00", endTime: "23:59", items: [...] }
// ]
```

### For AI Content Generation

**Use Case**: "Suggest a dish for 1 PM"

```typescript
import { findMenuForTime } from '@/lib/menu/menuPeriodParser';

// Find active menu at 13:00 (1 PM)
const currentMenu = findMenuForTime("13:00", menuPeriods);

if (currentMenu) {
  console.log(`Active menu: ${currentMenu.name}`);
  console.log(`Available items: ${currentMenu.items.join(', ')}`);
  // → Active menu: FROKOST
  // → Available items: Smørrebrød, Salat, Suppe, Sandwich
  
  // AI can now suggest from the lunch menu specifically
}
```

### For Time-Based Marketing

```typescript
// Morning post (8 AM)
const morningMenu = findMenuForTime("08:00", menuPeriods);
// → breakfast menu → Suggest "Start your day with our fresh bakery"

// Lunch post (12 PM)
const lunchMenu = findMenuForTime("12:00", menuPeriods);
// → lunch menu → Suggest "Quick lunch? Try our dagens ret"

// Evening post (6 PM)
const dinnerMenu = findMenuForTime("18:00", menuPeriods);
// → dinner menu → Suggest "Join us for dinner - see our evening menu"
```

## Implementation Checklist

### ✅ Completed

1. **Data Structure** - `MenuPeriod` interface defined
2. **Parser** - `menuPeriodParser.ts` with full parsing logic
3. **Concept Fit Integration** - Hours fit now checks menu periods
4. **Time Matching** - `findMenuForTime()` function for AI use

### ⏳ TODO

1. **Menu Extraction Update** - Modify `menu-extractor.ts` to explicitly extract and tag time ranges
2. **Database Schema** - Add `menu_periods` JSONB column to store parsed periods
3. **AI Generation Integration** - Update `ai-generate-v2` to use `findMenuForTime()`
4. **UI Display** - Show menu periods on Business Profile page
5. **Testing** - Test with real menus from FSE and SBO businesses

## Database Schema Suggestion

Add to `menu_extractions` table:

```sql
ALTER TABLE menu_extractions 
ADD COLUMN menu_periods JSONB;

-- Example data:
-- {
--   "periods": [
--     {
--       "name": "Brunch",
--       "type": "brunch",
--       "startTime": "09:00",
--       "endTime": "14:00",
--       "items": ["Æggekage", "Pandekager", "Smoothie"]
--     },
--     {
--       "name": "Frokost",
--       "type": "lunch",
--       "startTime": "11:30",
--       "endTime": "15:00",
--       "items": ["Smørrebrød", "Salat", "Suppe"]
--     }
--   ]
-- }
```

## Benefits

### For Concept Fit Analysis
- ✅ More accurate timing fit scores
- ✅ Better detection of office/transport hub suitability
- ✅ Identify menu gaps (e.g., "Open for lunch but no lunch menu")

### For AI Content Generation
- ✅ Time-appropriate menu suggestions
- ✅ Avoid suggesting dinner items in morning posts
- ✅ Match content to active menu periods
- ✅ Better seasonal/daily specials timing

### For Marketing Strategy
- ✅ Target posts to specific menu periods
- ✅ Optimize posting times based on menu availability
- ✅ Create period-specific campaigns (Brunch Saturdays, Lunch Specials, etc.)

## Example Output

**Before** (with only `menuSummary`):
```
Hours Fit: "Godt match for kontorets rytme"
```

**After** (with `menuPeriods`):
```
Hours Fit: "Perfekt match: Frokostmenu i kontorets rytme"
                          ↑ Enhanced with menu awareness
```

**AI Suggestion Before**:
```
"Visit us for lunch!" 
(AI doesn't know what's on the lunch menu)
```

**AI Suggestion After**:
```
"Visit us for lunch! Try our dagens ret or fresh smørrebrød"
                     ↑ AI found lunch menu and selected actual items
```

## Next Steps

1. **Update menu-extractor.ts**: Modify extraction to populate `menuPeriods` field
2. **Integrate with profile loading**: Parse menu periods when loading business data
3. **Update AI generate-v2**: Use `findMenuForTime()` to select appropriate menus
4. **Test with real data**: Validate parsing logic with actual Danish menus
5. **Add UI display**: Show menu periods on Business Profile page

## Questions?

- How should we handle menus with day-specific timing? (e.g., "Brunch only weekends")
- Should we store menu periods in database or compute on-the-fly?
- Do we need to handle menu item availability separately from period availability?
