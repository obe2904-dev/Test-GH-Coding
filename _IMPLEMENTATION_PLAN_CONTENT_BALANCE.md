# Implementation Plan: Content Balance & Strategic Transparency

**Date:** 2026-06-09  
**Objective:** Implement recommendations 1-3 from Weekly Plan review to improve content type balance tracking, strategic transparency, and business type classification.

---

## RECOMMENDATION 1: Long-Term Balance Tracking

### Goal
Ensure 8-week average of actual content_category distribution aligns with baseline weights, preventing sustained drift.

### Current Gap
- Content weights are modulated weekly (±8-15pp)
- No tracking of actual content_category distribution over time
- No feedback mechanism to detect/correct sustained drift
- Risk: 3+ consecutive weeks could modulate same direction → business feels "we never post menu items"

### Implementation Steps

#### 1.1 Database Schema
**File:** New migration `supabase/migrations/YYYYMMDD_add_content_distribution_tracking.sql`

```sql
-- Track actual content_category distribution per weekly plan
CREATE TABLE IF NOT EXISTS weekly_content_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_number INTEGER NOT NULL,
  strategy_id UUID REFERENCES weekly_strategies(id) ON DELETE CASCADE,
  
  -- Actual post counts by content_category
  product_menu_count INTEGER DEFAULT 0,
  craving_visual_count INTEGER DEFAULT 0,
  behind_scenes_count INTEGER DEFAULT 0,
  team_people_count INTEGER DEFAULT 0,
  total_posts INTEGER NOT NULL,
  
  -- Calculated percentages
  product_menu_pct DECIMAL(5,2),
  craving_visual_pct DECIMAL(5,2),
  behind_scenes_pct DECIMAL(5,2),
  team_people_pct DECIMAL(5,2),
  
  -- Baseline comparison (from brand_profile at time of generation)
  baseline_product_menu_pct DECIMAL(5,2),
  baseline_craving_visual_pct DECIMAL(5,2),
  baseline_behind_scenes_pct DECIMAL(5,2),
  baseline_team_people_pct DECIMAL(5,2),
  
  -- Drift metrics
  product_menu_drift DECIMAL(5,2),     -- actual - baseline
  craving_visual_drift DECIMAL(5,2),
  behind_scenes_drift DECIMAL(5,2),
  team_people_drift DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, week_start)
);

CREATE INDEX idx_content_distribution_business_date 
  ON weekly_content_distribution(business_id, week_start DESC);

COMMENT ON TABLE weekly_content_distribution IS 
  'Tracks actual content_category distribution per weekly plan for long-term balance analysis';
```

#### 1.2 Tracking Function
**File:** `supabase/functions/_shared/post-helpers/tracking/content-distribution-tracker.ts`

```typescript
export interface ContentDistribution {
  product_menu_count: number;
  craving_visual_count: number;
  behind_scenes_count: number;
  team_people_count: number;
  total_posts: number;
}

export interface BaselineWeights {
  product_menu: number;
  craving_visual: number;
  behind_scenes: number;
  team_people: number;
}

/**
 * Calculate content distribution from weekly plan posts
 */
export function calculateContentDistribution(
  posts: Array<{ content_category?: string }>
): ContentDistribution {
  const counts = {
    product_menu: 0,
    craving_visual: 0,
    behind_scenes: 0,
    team_people: 0
  };
  
  for (const post of posts) {
    const cat = post.content_category;
    if (cat && cat in counts) {
      counts[cat as keyof typeof counts]++;
    }
  }
  
  return {
    product_menu_count: counts.product_menu,
    craving_visual_count: counts.craving_visual,
    behind_scenes_count: counts.behind_scenes,
    team_people_count: counts.team_people,
    total_posts: posts.length
  };
}

/**
 * Save content distribution tracking record
 */
export async function trackContentDistribution(
  supabaseClient: any,
  businessId: string,
  weekStart: string,
  weekNumber: number,
  strategyId: string,
  posts: Array<{ content_category?: string }>,
  baselineWeights: BaselineWeights
): Promise<void> {
  const dist = calculateContentDistribution(posts);
  
  // Calculate percentages
  const total = dist.total_posts || 1; // Avoid division by zero
  const productMenuPct = (dist.product_menu_count / total) * 100;
  const cravingVisualPct = (dist.craving_visual_count / total) * 100;
  const behindScenesPct = (dist.behind_scenes_count / total) * 100;
  const teamPeoplePct = (dist.team_people_count / total) * 100;
  
  // Calculate drift from baseline
  const productMenuDrift = productMenuPct - baselineWeights.product_menu;
  const cravingVisualDrift = cravingVisualPct - baselineWeights.craving_visual;
  const behindScenesDrift = behindScenesPct - baselineWeights.behind_scenes;
  const teamPeopleDrift = teamPeoplePct - baselineWeights.team_people;
  
  const { error } = await supabaseClient
    .from('weekly_content_distribution')
    .upsert({
      business_id: businessId,
      week_start: weekStart,
      week_number: weekNumber,
      strategy_id: strategyId,
      ...dist,
      product_menu_pct: productMenuPct,
      craving_visual_pct: cravingVisualPct,
      behind_scenes_pct: behindScenesPct,
      team_people_pct: teamPeoplePct,
      baseline_product_menu_pct: baselineWeights.product_menu,
      baseline_craving_visual_pct: baselineWeights.craving_visual,
      baseline_behind_scenes_pct: baselineWeights.behind_scenes,
      baseline_team_people_pct: baselineWeights.team_people,
      product_menu_drift: productMenuDrift,
      craving_visual_drift: cravingVisualDrift,
      behind_scenes_drift: behindScenesDrift,
      team_people_drift: teamPeopleDrift
    }, {
      onConflict: 'business_id,week_start'
    });
  
  if (error) {
    console.error('[ContentDistributionTracker] Failed to save:', error);
  } else {
    console.log('[ContentDistributionTracker] Saved distribution:', {
      week: weekNumber,
      total: dist.total_posts,
      menu: dist.product_menu_count,
      visual: dist.craving_visual_count,
      behind: dist.behind_scenes_count,
      team: dist.team_people_count
    });
  }
}

/**
 * Get 8-week rolling average drift
 */
export async function get8WeekDrift(
  supabaseClient: any,
  businessId: string,
  beforeWeekStart: string
): Promise<{
  product_menu_avg_drift: number;
  craving_visual_avg_drift: number;
  behind_scenes_avg_drift: number;
  team_people_avg_drift: number;
  weeks_analyzed: number;
} | null> {
  const { data, error } = await supabaseClient
    .from('weekly_content_distribution')
    .select('product_menu_drift, craving_visual_drift, behind_scenes_drift, team_people_drift')
    .eq('business_id', businessId)
    .lt('week_start', beforeWeekStart)
    .order('week_start', { ascending: false })
    .limit(8);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  const sum = data.reduce((acc, row) => ({
    product_menu: acc.product_menu + (row.product_menu_drift || 0),
    craving_visual: acc.craving_visual + (row.craving_visual_drift || 0),
    behind_scenes: acc.behind_scenes + (row.behind_scenes_drift || 0),
    team_people: acc.team_people + (row.team_people_drift || 0)
  }), { product_menu: 0, craving_visual: 0, behind_scenes: 0, team_people: 0 });
  
  const count = data.length;
  
  return {
    product_menu_avg_drift: sum.product_menu / count,
    craving_visual_avg_drift: sum.craving_visual / count,
    behind_scenes_avg_drift: sum.behind_scenes / count,
    team_people_avg_drift: sum.team_people / count,
    weeks_analyzed: count
  };
}
```

#### 1.3 Integration with get-weekly-strategy
**File:** `supabase/functions/get-weekly-strategy/index.ts`

**Location:** After saving weekly_strategies and weekly_content_plans (around line 1600)

```typescript
// Track content distribution for long-term balance analysis
try {
  const baselineWeights: BaselineWeights = {
    product_menu: weekContext.brand_voice.content_strategy?.content_category_weights?.product_menu || 40,
    craving_visual: weekContext.brand_voice.content_strategy?.content_category_weights?.craving_visual || 30,
    behind_scenes: weekContext.brand_voice.content_strategy?.content_category_weights?.behind_scenes || 20,
    team_people: weekContext.brand_voice.content_strategy?.content_category_weights?.team_people || 10
  };
  
  await trackContentDistribution(
    dataClient,
    body.business_id,
    weekStartStr,
    weekNumber,
    strategyRowId,
    strategy.post_ideas,
    baselineWeights
  );
} catch (trackError) {
  console.warn('[get-weekly-strategy] Content distribution tracking failed:', trackError);
  // Non-critical - continue
}
```

#### 1.4 Drift Correction in Strategy Modulator
**File:** `supabase/functions/_shared/post-helpers/strategy/strategy-modulator.ts`

**Location:** Before `generateWeeklyModulation()` calls AI (around line 430)

```typescript
// Check for sustained drift and apply gentle correction
let driftCorrection: Record<string, number> | null = null;

if (weekContext.business_id) {
  const drift = await get8WeekDrift(
    supabaseClient, 
    weekContext.business_id, 
    weekContext.week_start
  );
  
  if (drift && drift.weeks_analyzed >= 4) {
    // Apply correction if average drift > 15% over 4+ weeks
    const DRIFT_THRESHOLD = 15;
    const CORRECTION_STRENGTH = 0.5; // 50% correction toward baseline
    
    driftCorrection = {};
    
    if (Math.abs(drift.product_menu_avg_drift) > DRIFT_THRESHOLD) {
      driftCorrection.product_menu = -drift.product_menu_avg_drift * CORRECTION_STRENGTH;
      console.log(`[StrategyModulator] Drift correction: product_menu ${drift.product_menu_avg_drift.toFixed(1)}pp → apply ${driftCorrection.product_menu.toFixed(1)}pp correction`);
    }
    if (Math.abs(drift.craving_visual_avg_drift) > DRIFT_THRESHOLD) {
      driftCorrection.craving_visual = -drift.craving_visual_avg_drift * CORRECTION_STRENGTH;
      console.log(`[StrategyModulator] Drift correction: craving_visual ${drift.craving_visual_avg_drift.toFixed(1)}pp → apply ${driftCorrection.craving_visual.toFixed(1)}pp correction`);
    }
    if (Math.abs(drift.behind_scenes_avg_drift) > DRIFT_THRESHOLD) {
      driftCorrection.behind_scenes = -drift.behind_scenes_avg_drift * CORRECTION_STRENGTH;
    }
    if (Math.abs(drift.team_people_avg_drift) > DRIFT_THRESHOLD) {
      driftCorrection.team_people = -drift.team_people_avg_drift * CORRECTION_STRENGTH;
    }
  }
}

// Apply drift correction to modulated weights (AFTER AI modulation, BEFORE returning)
if (driftCorrection && Object.keys(driftCorrection).length > 0) {
  for (const [category, correction] of Object.entries(driftCorrection)) {
    if (weekContentCategoryWeights[category] !== undefined) {
      weekContentCategoryWeights[category] += correction;
      weekContentCategoryWeights[category] = Math.max(10, Math.min(70, weekContentCategoryWeights[category]));
    }
  }
  
  // Re-normalize to 100%
  const total = Object.values(weekContentCategoryWeights).reduce((sum, v) => sum + v, 0);
  for (const key of Object.keys(weekContentCategoryWeights)) {
    weekContentCategoryWeights[key] = (weekContentCategoryWeights[key] / total) * 100;
  }
}
```

#### 1.5 Testing Verification
- Generate 8 consecutive weekly plans for Cafe Faust
- Verify weekly_content_distribution records are created
- Manually force 4 weeks to heavily favor menu posts (simulated drift)
- Verify week 5+ shows drift correction in modulation
- Confirm 8-week average converges back to baseline

---

## RECOMMENDATION 2: Surface Strategic Rationale to User

### Goal
Make the sophisticated weekly variation logic visible to users so they understand WHY specific post types were chosen.

### Current Gap
- `week_strategic_rationale` is generated by StrategyModulator
- Saved to `weekly_strategies.strategy_rationale` column
- **Not prominently displayed in UI** → user sees posts but not the reasoning

### Implementation Steps

#### 2.1 Verify Data Flow
**Status:** ✅ Already implemented

- `strategy-modulator.ts` generates `week_strategic_rationale`
- Saved at `get-weekly-strategy/index.ts:1574`
- Column exists: `weekly_strategies.strategy_rationale`

#### 2.2 Add to TypeScript Types
**File:** `src/types/weekly-plan.ts`

**Add to `WeeklyContentPlan` interface (around line 215):**

```typescript
  // Strategic rationale — why this week's content mix was chosen
  strategicRationale?: string | null;
```

#### 2.3 Load from Database
**File:** `src/app/content/ai-weekly-plan/page.tsx`

**Location 1:** Where plan is loaded from `weekly_content_plans` (around line 720)

```typescript
strategyNarrative: data.plan.strategyNarrative || strategyData.narrative,
strategicRationale: strategyData.strategy_rationale || null, // ADD THIS
```

**Location 2:** When constructing plan from strategy row (after polling, around line 850)

```typescript
const transformedPlan: WeeklyContentPlan = {
  id: planRow.id,
  userId: session.user.id,
  businessId: bizData.id,
  weekNumber: planRow.week_number,
  weekStart: planRow.week_start,
  weekEnd: planRow.week_end,
  generatedAt: planRow.generated_at,
  strategyNarrative: planRow.narrative || undefined,
  strategicRationale: planRow.strategy_rationale || null, // ADD THIS
  // ... rest of fields
};
```

**Location 3:** When loading existing plan (around line 190)

```typescript
const transformedPlan: WeeklyContentPlan = {
  id: planRow.id,
  userId: planRow.user_id,
  businessId: planRow.business_id,
  weekNumber: planRow.week_number,
  weekStart: planRow.week_start,
  weekEnd: planRow.week_end,
  generatedAt: planRow.generated_at,
  strategyNarrative: strategyData.narrative,
  strategicRationale: strategyData.strategy_rationale || null, // ADD THIS
  // ... rest
};
```

#### 2.4 Display in WeeklyPlanOverview UI
**File:** `src/components/weekly-plan/WeeklyPlanOverview.tsx`

**Location:** After weather block, before strategyNarrative block (around line 280)

```typescript
        {/* Strategic Rationale — WHY this content mix */}
        {plan.strategicRationale && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-purple-900 mb-1.5 uppercase tracking-wide">
                  {t('weeklyPlan.overview.strategicRationale.title', 'Ugens Strategi')}
                </div>
                <p className="text-sm text-purple-800 leading-relaxed">
                  {plan.strategicRationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Narrative — existing block unchanged */}
        {plan.strategyNarrative ? (
          // ... existing code
```

#### 2.5 Add Translation Keys
**File:** `public/locales/da/translation.json`

```json
"weeklyPlan": {
  "overview": {
    "strategicRationale": {
      "title": "Ugens Strategi",
      "subtitle": "Hvorfor netop denne blanding af posts?"
    }
  }
}
```

#### 2.6 Testing Verification
- Generate new weekly plan
- Verify `strategy_rationale` appears in UI (purple card above strategy narrative)
- Verify text explains content mix (e.g., "Denne uge fokuserer vi på visuelle posts (40%) fordi solrigt vejr gør terrassepladser til en konkurrencefordel")
- Test with different modulation scenarios (weather, economic, events)

---

## RECOMMENDATION 3: Explicit Business Type Field

### Goal
Store validated `business_archetype` explicitly in database instead of relying on inference, enabling consistent business-type-specific strategy.

### Current Gap
- `business_archetype` is inferred from `service_periods`, `late_night_closing`, `menu_programmes`
- Not validated or stored persistently
- Risk: Hybrid businesses get inconsistent treatment week-to-week

### Implementation Steps

#### 3.1 Database Schema Enhancement
**File:** New migration `supabase/migrations/YYYYMMDD_add_explicit_business_archetype.sql`

```sql
-- Add explicit business_archetype column with validation
DO $$ BEGIN
  CREATE TYPE business_archetype_enum AS ENUM (
    'fine_dining',
    'casual_dining',
    'cafe_bistro',
    'cafe_bar',
    'wine_bar',
    'coffee_shop',
    'quick_service',
    'bakery',
    'morning_cafe',
    'brunch_cafe',
    'all_day_cafe',
    'lunch_restaurant',
    'dinner_restaurant',
    'full_service_restaurant',
    'evening_bar',
    'late_night_bar',
    'nightlife_bar',
    'brunch_specialist',
    'fast_casual'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS business_archetype business_archetype_enum;

COMMENT ON COLUMN business_brand_profile.business_archetype IS
  'Explicit validated business archetype - determines content strategy defaults and timing recommendations';

-- Add index for archetype-based queries
CREATE INDEX IF NOT EXISTS idx_brand_profile_archetype 
  ON business_brand_profile(business_archetype) WHERE business_archetype IS NOT NULL;
```

#### 3.2 TypeScript Type Enhancement
**File:** `supabase/functions/_shared/post-helpers/types/strategy-types.ts`

**Already exists at line 76-99** ✅

**Add validation function:**

```typescript
/**
 * Validate and normalize business archetype string
 */
export function validateBusinessArchetype(value: unknown): BusinessArchetype | null {
  if (typeof value !== 'string') return null;
  
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '_');
  
  const validArchetypes: BusinessArchetype[] = [
    'fine_dining', 'casual_dining', 'cafe_bistro', 'cafe_bar', 'wine_bar',
    'coffee_shop', 'quick_service', 'bakery', 'morning_cafe', 'brunch_cafe',
    'all_day_cafe', 'lunch_restaurant', 'dinner_restaurant', 'full_service_restaurant',
    'evening_bar', 'late_night_bar', 'nightlife_bar', 'brunch_specialist', 'fast_casual'
  ];
  
  if (validArchetypes.includes(normalized as BusinessArchetype)) {
    return normalized as BusinessArchetype;
  }
  
  return null;
}
```

#### 3.3 Brand Profile Generator Integration
**File:** `supabase/functions/brand-profile-generator/index.ts`

**Add archetype inference logic (new section):**

```typescript
/**
 * Infer business archetype from service periods, hours, and menu
 */
function inferBusinessArchetype(
  servicePeriods: string[],
  lateNightClosing: boolean,
  menuProgrammes: Array<{ role: string; timeContext: string | null }> | null,
  businessCharacter: string
): BusinessArchetype {
  const hasBreakfast = servicePeriods.includes('breakfast');
  const hasBrunch = servicePeriods.includes('brunch');
  const hasLunch = servicePeriods.includes('lunch');
  const hasDinner = servicePeriods.includes('dinner');
  const hasDrinks = servicePeriods.includes('drinks') || servicePeriods.includes('bar');
  
  // Wine bar signals
  if (businessCharacter.toLowerCase().includes('vinbar') || businessCharacter.toLowerCase().includes('wine bar')) {
    return lateNightClosing ? 'late_night_bar' : 'wine_bar';
  }
  
  // Coffee shop / morning cafe
  if (hasBreakfast && !hasLunch && !hasDinner) {
    return 'morning_cafe';
  }
  
  // Brunch specialist
  if (hasBrunch && !hasDinner && !lateNightClosing) {
    return 'brunch_cafe';
  }
  
  // All-day cafe (brunch + lunch, no dinner)
  if ((hasBrunch || hasBreakfast) && hasLunch && !hasDinner) {
    return 'all_day_cafe';
  }
  
  // Cafe-bar hybrid (day cafe → evening bar)
  if ((hasBrunch || hasLunch) && (hasDrinks || lateNightClosing)) {
    return 'cafe_bar';
  }
  
  // Lunch-only restaurant
  if (hasLunch && !hasDinner && !hasBrunch) {
    return 'lunch_restaurant';
  }
  
  // Dinner-only restaurant
  if (hasDinner && !hasLunch && !hasBrunch) {
    return 'dinner_restaurant';
  }
  
  // Full-service restaurant
  if ((hasLunch || hasBrunch) && hasDinner) {
    return 'full_service_restaurant';
  }
  
  // Evening bar (drinks only, no full kitchen)
  if (hasDrinks && !hasLunch && !hasDinner) {
    return lateNightClosing ? 'late_night_bar' : 'evening_bar';
  }
  
  // Fine dining vs casual dining (heuristic)
  if (hasDinner) {
    const isFine = businessCharacter.toLowerCase().includes('michelin') ||
                   businessCharacter.toLowerCase().includes('gourmet') ||
                   businessCharacter.toLowerCase().includes('fine dining');
    return isFine ? 'fine_dining' : 'casual_dining';
  }
  
  // Fallback
  return 'cafe_bistro';
}
```

**Save to database (in Stage A - Core Identity, after business_character):**

```typescript
const inferredArchetype = inferBusinessArchetype(
  servicePeriods,
  lateNightClosing,
  menuProgrammes,
  businessCharacter
);

// Update brand profile with explicit archetype
const { error: archetypeError } = await supabaseClient
  .from('business_brand_profile')
  .update({
    business_archetype: inferredArchetype
  })
  .eq('business_id', businessId);

if (archetypeError) {
  console.warn('[BrandProfileGenerator] Failed to save business_archetype:', archetypeError);
} else {
  console.log('[BrandProfileGenerator] Business archetype set:', inferredArchetype);
}
```

#### 3.4 Strategy Modulator Enhancement
**File:** `supabase/functions/_shared/post-helpers/strategy/strategy-modulator.ts`

**Location:** Line 324 (existing code that reads from context)

**Replace:**
```typescript
${(context as any).business_archetype ? `- Virksomhedsarketype: ${(context as any).business_archetype.replace(/_/g, ' ')}` : ''}
```

**With:**
```typescript
${context.business_archetype ? `- Virksomhedsarketype: ${context.business_archetype.replace(/_/g, ' ')} (validated)` : '- Virksomhedsarketype: afledt fra åbningstider'}
```

#### 3.5 UI: Brand Profile Display
**File:** `src/components/brandProfile/BrandProfileDisplay.tsx`

**Add display section (after Business Character, around line 420):**

```typescript
        {/* Business Archetype */}
        {brandProfile?.business_archetype && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Forretningstype
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <span className="text-3xl">
                  {getArchetypeIcon(brandProfile.business_archetype)}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-700 mb-1">
                  {formatArchetypeName(brandProfile.business_archetype)}
                </div>
                <div className="text-xs text-slate-500">
                  Bruges til timing-anbefalinger og content-strategi
                </div>
              </div>
            </div>
          </div>
        )}
```

**Add helper functions:**

```typescript
function getArchetypeIcon(archetype: string): string {
  const icons: Record<string, string> = {
    fine_dining: '🍽️',
    casual_dining: '🍴',
    cafe_bistro: '☕',
    cafe_bar: '🍷',
    wine_bar: '🍷',
    coffee_shop: '☕',
    morning_cafe: '🌅',
    brunch_cafe: '🥐',
    all_day_cafe: '☕',
    lunch_restaurant: '🍱',
    dinner_restaurant: '🍽️',
    full_service_restaurant: '🍴',
    evening_bar: '🍸',
    late_night_bar: '🌙',
    nightlife_bar: '🎉',
    brunch_specialist: '🥂',
    fast_casual: '🍔'
  };
  return icons[archetype] || '🏪';
}

function formatArchetypeName(archetype: string): string {
  const names: Record<string, string> = {
    fine_dining: 'Fine Dining Restaurant',
    casual_dining: 'Casual Dining Restaurant',
    cafe_bistro: 'Café & Bistro',
    cafe_bar: 'Café-Bar (Hybrid)',
    wine_bar: 'Vinbar',
    coffee_shop: 'Kaffebar',
    morning_cafe: 'Morgencafé',
    brunch_cafe: 'Brunchcafé',
    all_day_cafe: 'Heldagscafé',
    lunch_restaurant: 'Frokostrestaurant',
    dinner_restaurant: 'Aftenrestaurant',
    full_service_restaurant: 'Full-Service Restaurant',
    evening_bar: 'Aftenbar',
    late_night_bar: 'Natbar',
    nightlife_bar: 'Natteliv & Bar',
    brunch_specialist: 'Brunch-Specialist',
    fast_casual: 'Fast Casual'
  };
  return names[archetype] || archetype.replace(/_/g, ' ');
}
```

#### 3.6 UI: Admin Override (Optional Future Enhancement)
**File:** New component `src/components/brandProfile/ArchetypeSelector.tsx`

```typescript
import { useState } from 'react';
import type { BusinessArchetype } from '../../types/brand-profile';

interface ArchetypeSelectorProps {
  currentArchetype: BusinessArchetype | null;
  onSave: (archetype: BusinessArchetype) => Promise<void>;
}

export function ArchetypeSelector({ currentArchetype, onSave }: ArchetypeSelectorProps) {
  const [selected, setSelected] = useState<BusinessArchetype | null>(currentArchetype);
  const [saving, setSaving] = useState(false);

  const archetypes: Array<{ value: BusinessArchetype; label: string; description: string }> = [
    { value: 'fine_dining', label: 'Fine Dining', description: 'Michelinstjernet/gourmet' },
    { value: 'casual_dining', label: 'Casual Dining', description: 'Uformel familierestaurant' },
    { value: 'cafe_bistro', label: 'Café & Bistro', description: 'Klassisk café med let menu' },
    { value: 'cafe_bar', label: 'Café-Bar', description: 'Café om dagen, bar om aftenen' },
    { value: 'wine_bar', label: 'Vinbar', description: 'Fokus på vin og tapas' },
    { value: 'coffee_shop', label: 'Kaffebar', description: 'Kaffe og bagværk' },
    { value: 'morning_cafe', label: 'Morgencafé', description: 'Morgenmad, lukker tidligt' },
    { value: 'brunch_cafe', label: 'Brunchcafé', description: 'Brunch-fokus, weekend-travlt' },
    { value: 'all_day_cafe', label: 'Heldagscafé', description: 'Morgenmad, brunch, frokost' },
    { value: 'lunch_restaurant', label: 'Frokostrestaurant', description: 'Kun frokost' },
    { value: 'dinner_restaurant', label: 'Aftenrestaurant', description: 'Kun middag' },
    { value: 'full_service_restaurant', label: 'Full-Service', description: 'Frokost + middag' },
    { value: 'evening_bar', label: 'Aftenbar', description: 'Åbner om aftenen' },
    { value: 'late_night_bar', label: 'Natbar', description: 'Åbent efter midnat' },
    { value: 'nightlife_bar', label: 'Natteliv', description: 'Club/natteliv-fokus' },
    { value: 'brunch_specialist', label: 'Brunch-Specialist', description: 'Premium brunch' },
    { value: 'fast_casual', label: 'Fast Casual', description: 'QSR/food truck' }
  ];

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {archetypes.map(arch => (
          <button
            key={arch.value}
            onClick={() => setSelected(arch.value)}
            className={`text-left p-3 rounded-lg border-2 transition-colors ${
              selected === arch.value
                ? 'border-cta bg-cta-surface'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="font-medium text-sm text-slate-900">{arch.label}</div>
            <div className="text-xs text-slate-600 mt-0.5">{arch.description}</div>
          </button>
        ))}
      </div>
      
      <button
        onClick={handleSave}
        disabled={saving || selected === currentArchetype}
        className="px-4 py-2 bg-cta text-white rounded-lg hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Gemmer...' : 'Gem forretningstype'}
      </button>
    </div>
  );
}
```

#### 3.7 Testing Verification
- Run brand profile generator for Cafe Faust
- Verify `business_archetype` is saved to database (expected: `cafe_bar`)
- Verify archetype displays in Brand Profile UI
- Generate weekly plan and verify archetype is used in strategy modulation
- Test archetype selector UI (optional admin override)

---

## IMPLEMENTATION ORDER

### Phase 1: Strategic Rationale (Quickest Win)
**Time Estimate:** 2-3 hours

1. Update `WeeklyContentPlan` TypeScript type
2. Load `strategy_rationale` from database (3 locations)
3. Add UI display component in `WeeklyPlanOverview`
4. Add translation keys
5. Test with new weekly plan generation

**Why First:** 
- Smallest change
- Immediate user visibility improvement
- No database migration needed
- High user value (explains the "why")

### Phase 2: Explicit Business Archetype
**Time Estimate:** 4-6 hours

1. Create database migration (enum + column)
2. Add validation function
3. Update brand profile generator with inference logic
4. Add UI display in Brand Profile
5. Update strategy modulator to use validated field
6. Test with Cafe Faust regeneration

**Why Second:**
- Moderate complexity
- Improves consistency for future weeks
- Prepares foundation for better content type adaptation

### Phase 3: Long-Term Balance Tracking
**Time Estimate:** 6-8 hours

1. Create database migration (weekly_content_distribution table)
2. Implement tracking functions
3. Integrate with get-weekly-strategy
4. Add drift calculation logic
5. Integrate drift correction into strategy modulator
6. Test with 8-week simulation

**Why Last:**
- Most complex implementation
- Requires multiple weeks to verify effectiveness
- Depends on having consistent business_archetype (Phase 2)
- Benefits accumulate over time

---

## ROLLBACK PLAN

### Recommendation 1 (Balance Tracking)
- Drop `weekly_content_distribution` table
- Remove tracking calls from `get-weekly-strategy`
- Remove drift correction from `strategy-modulator`

### Recommendation 2 (Strategic Rationale)
- Remove `strategicRationale` from TypeScript types
- Remove UI display component
- Data remains in database (harmless)

### Recommendation 3 (Business Archetype)
- Set `business_archetype` column to nullable (don't drop enum)
- Remove UI display
- Fallback to inference in strategy-modulator (already exists)

---

## SUCCESS METRICS

### Recommendation 1
- [ ] Distribution tracked for 100% of new weekly plans
- [ ] 8-week average drift stays < 15pp from baseline
- [ ] At least 1 drift correction event logged in 8-week period

### Recommendation 2
- [ ] Strategic rationale displays for all new weekly plans
- [ ] User survey: "Do you understand why these posts were chosen?" (target: >80% yes)

### Recommendation 3
- [ ] Business archetype saved for all businesses with brand profiles
- [ ] Archetype accuracy validated manually for 10 test businesses
- [ ] Strategy modulator uses validated archetype in 100% of cases

---

## DEPENDENCIES

- Supabase migrations system
- TypeScript type generation from database
- React UI components
- Translation system (i18next)

## RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Drift correction over-corrects | Content feels forced | Limit correction to 50% of drift, apply gradually |
| Strategic rationale is too technical | User confusion | Review AI prompt to ensure plain Danish |
| Archetype inference wrong for hybrids | Poor content strategy | Manual override UI (Phase 3.6) |
| Tracking table grows too large | Performance | Add retention policy (keep only last 26 weeks) |

---

## NEXT STEPS

1. **Review this plan** with stakeholders
2. **Prioritize phases** (suggested: 2 → 1 → 3)
3. **Create branches** for each phase
4. **Implement Phase 1** (Strategic Rationale) first for quick win
5. **Iterate** based on user feedback

---

**END OF IMPLEMENTATION PLAN**
