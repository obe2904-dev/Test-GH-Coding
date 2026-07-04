# Historical Analysis System - Business Type Adaptation

## How It Works for Different Restaurant Types

### Example 1: Café Faust (Complex Hybrid - 4 Programmes)

**V5 Profile:**
- Programme 1: Brunch (Sat-Sun 10-14) - Drive 20%, Brand 60%, Loyalty 20%
- Programme 2: Frokost (Mon-Fri 12-14) - Drive 70%, Brand 20%, Loyalty 10%
- Programme 3: Aftensmad (Thu-Sat 17-22) - Drive 30%, Brand 40%, Loyalty 30%
- Programme 4: Bar/Cocktails (Fri-Sat 22-24) - Drive 40%, Brand 50%, Loyalty 10%

**Historical Analysis Output (After 3 Weeks):**

```json
{
  "weeks_analyzed": 3,
  "total_posts_analyzed": 12,
  "programme_patterns": {
    "Brunch": {
      "total_posts": 3,
      "content_categories": {
        "atmosphere": 2,
        "menu_item": 1
      },
      "goal_modes": {
        "build_brand": 2,
        "drive_footfall": 1
      },
      "menu_items": ["Eggs Benedict", "Avocado Toast"]
    },
    "Frokost": {
      "total_posts": 3,
      "content_categories": {
        "menu_item": 2,
        "daily_special": 1
      },
      "goal_modes": {
        "drive_footfall": 3
      },
      "menu_items": ["Beef Tartare", "Caesar Salad", "Soup of the Day"]
    },
    "Aftensmad": {
      "total_posts": 4,
      "content_categories": {
        "atmosphere": 3,
        "behind_scenes": 1
      },
      "goal_modes": {
        "build_brand": 3,
        "retain_loyalty": 1
      },
      "menu_items": ["Seasonal Fish"]
    },
    "Bar": {
      "total_posts": 2,
      "content_categories": {
        "menu_item": 1,
        "behind_scenes": 1
      },
      "goal_modes": {
        "build_brand": 1,
        "drive_footfall": 1
      },
      "menu_items": ["Negroni"]
    }
  },
  "overuse_warnings": [
    "Aftensmad+atmosphere (3x in 3 weeks)",
    "Frokost+drive_footfall (3x in 3 weeks - over baseline)"
  ],
  "underuse_opportunities": [
    "Brunch+loyalty_content",
    "Frokost+behind_scenes",
    "Aftensmad+menu_item",
    "Bar+seasonal_content"
  ],
  "recent_dishes": ["Eggs Benedict", "Avocado Toast", "Beef Tartare", "Caesar Salad", "Soup of the Day", "Seasonal Fish", "Negroni"]
}
```

**Phase 2a Receives:**
```
HISTORISK KONTEKST (sidste 3 uger, 12 opslag):

Programme-fordeling:
  • Brunch: 3 opslag - atmosphere(2), menu_item(1)
  • Frokost: 3 opslag - menu_item(2), daily_special(1)
  • Aftensmad: 4 opslag - atmosphere(3), behind_scenes(1)
  • Bar: 2 opslag - menu_item(1), behind_scenes(1)

⚠️ UNDGÅ GENTAGELSE (brugt for ofte):
  - Aftensmad+atmosphere (3x in 3 weeks)
  - Frokost+drive_footfall (3x - over baseline)

✨ FRISKE MULIGHEDER (endnu ikke brugt):
  - Brunch+loyalty_content
  - Frokost+behind_scenes
  - Aftensmad+menu_item
  - Bar+seasonal_content

🍽️ Senest viste retter: Eggs Benedict, Avocado Toast, Beef Tartare, Caesar Salad, Soup of the Day, Seasonal Fish, Negroni
   → Vælg ANDRE retter denne uge for variation
```

**Result:** AI avoids Aftensmad atmosphere shots, shows menu items instead. Adds loyalty content for Brunch. Rotates to different dishes.

---

### Example 2: Trattoria Italiana (Specialized Italian - 2 Programmes)

**V5 Profile:**
- Programme 1: Lunch (Tue-Fri 12-15) - Drive 60%, Brand 30%, Loyalty 10%
- Programme 2: Dinner (Tue-Sun 18-22) - Drive 40%, Brand 40%, Loyalty 20%

**Historical Analysis Output (After 3 Weeks):**

```json
{
  "weeks_analyzed": 3,
  "total_posts_analyzed": 11,
  "programme_patterns": {
    "Lunch": {
      "total_posts": 4,
      "content_categories": {
        "menu_item": 3,
        "daily_special": 1
      },
      "goal_modes": {
        "drive_footfall": 4
      },
      "menu_items": ["Pasta Carbonara", "Risotto ai Funghi", "Lasagna", "Saltimbocca"]
    },
    "Dinner": {
      "total_posts": 7,
      "content_categories": {
        "atmosphere": 3,
        "menu_item": 2,
        "behind_scenes": 2
      },
      "goal_modes": {
        "build_brand": 4,
        "drive_footfall": 2,
        "retain_loyalty": 1
      },
      "menu_items": ["Osso Buco", "Seafood Risotto", "Tiramisu"]
    }
  },
  "overuse_warnings": [
    "Lunch+menu_item (3x in 3 weeks)",
    "Dinner+atmosphere (3x in 3 weeks)"
  ],
  "underuse_opportunities": [
    "Lunch+behind_scenes",
    "Lunch+seasonal_content",
    "Dinner+loyalty_content"
  ],
  "recent_dishes": ["Pasta Carbonara", "Risotto ai Funghi", "Lasagna", "Saltimbocca", "Osso Buco", "Seafood Risotto", "Tiramisu"]
}
```

**Phase 2a Receives:**
```
HISTORISK KONTEKST (sidste 3 uger, 11 opslag):

Programme-fordeling:
  • Lunch: 4 opslag - menu_item(3), daily_special(1)
  • Dinner: 7 opslag - atmosphere(3), menu_item(2), behind_scenes(2)

⚠️ UNDGÅ GENTAGELSE (brugt for ofte):
  - Lunch+menu_item (3x in 3 weeks)
  - Dinner+atmosphere (3x in 3 weeks)

✨ FRISKE MULIGHEDER (endnu ikke brugt):
  - Lunch+behind_scenes
  - Lunch+seasonal_content
  - Dinner+loyalty_content

🍽️ Senest viste retter: Pasta Carbonara, Risotto ai Funghi, Lasagna, Saltimbocca, Osso Buco, Seafood Risotto, Tiramisu
   → Vælg ANDRE retter denne uge for variation
```

**Result:** AI shows behind-scenes for Lunch (pasta-making process), loyalty content for Dinner (chef's story, regular customer recognition), and rotates to different dishes (Pappardelle al Cinghiale, Branzino al Forno).

---

### Example 3: Fine Dining (Single Programme - Dinner Only)

**V5 Profile:**
- Programme 1: Dinner (Wed-Sun 18-22) - Drive 30%, Brand 50%, Loyalty 20%

**Historical Analysis Output (After 3 Weeks):**

```json
{
  "weeks_analyzed": 3,
  "total_posts_analyzed": 12,
  "programme_patterns": {
    "Dinner": {
      "total_posts": 12,
      "content_categories": {
        "menu_item": 5,
        "atmosphere": 4,
        "behind_scenes": 2,
        "seasonal_content": 1
      },
      "goal_modes": {
        "build_brand": 7,
        "drive_footfall": 3,
        "retain_loyalty": 2
      },
      "menu_items": ["Scallops", "Venison", "Duck Breast", "Tasting Menu", "Dessert Tasting"]
    }
  },
  "overuse_warnings": [
    "Dinner+menu_item (5x in 3 weeks - approaching overuse)"
  ],
  "underuse_opportunities": [
    "Dinner+loyalty_content"
  ],
  "recent_dishes": ["Scallops", "Venison", "Duck Breast", "Tasting Menu", "Dessert Tasting"]
}
```

**Phase 2a Receives:**
```
HISTORISK KONTEKST (sidste 3 uger, 12 opslag):

Programme-fordeling:
  • Dinner: 12 opslag - menu_item(5), atmosphere(4), behind_scenes(2), seasonal_content(1)

⚠️ UNDGÅ GENTAGELSE (brugt for ofte):
  - Dinner+menu_item (5x in 3 weeks)

✨ FRISKE MULIGHEDER (endnu ikke brugt):
  - Dinner+loyalty_content

🍽️ Senest viste retter: Scallops, Venison, Duck Breast, Tasting Menu, Dessert Tasting
   → Vælg ANDRE retter denne uge for variation
```

**Result:** Even with single programme, system ensures variety. AI balances between atmosphere, behind-scenes, seasonal content, and occasional menu items (but different dishes). Adds loyalty content (sommelier profile, wine pairing insights).

---

## Key Adaptations by Business Type

### Complex Hybrid (4+ Programmes)
- Tracks patterns per programme independently
- Ensures each programme gets varied content
- Prevents cross-programme repetition
- Balances goal distribution across all programmes

### Specialized Restaurant (2-3 Programmes)
- Simpler tracking but same principles
- Focuses on cuisine-specific variation (pasta types, cooking methods, regional dishes)
- Still ensures goal mode balance per programme
- Leverages seasonal ingredients for variation

### Single Programme (Dinner Only)
- All variation happens within one programme
- Relies heavily on content category diversity
- Menu item rotation becomes critical
- Goal mode balance tracked over longer period

## Anti-Repetition Rules (Universal)

1. **Hard Rule:** Same programme + same content_category → max 2x in 3 weeks (warn at 3x)
2. **Soft Rule:** Same programme + same goal_mode → shouldn't exceed baseline ±30% over 3 weeks
3. **Dish Rule:** Same menu item → min 3 weeks between features
4. **Freshness Bonus:** Underused categories get priority boost in content selection

## Integration Point

This analysis runs in `get-weekly-strategy/index.ts` BEFORE Phase 1:

```typescript
// 1. Fetch V5 profile
// 2. Fetch operations/menu/location
// 3. → NEW: Analyze historical content (3 weeks)
// 4. Build WeekContext (include historical_context)
// 5. Run Phase 0 → Phase 1 → Phase 2
```

Phase 2a receives historical context and explicitly avoids repetition while respecting programme baselines.
