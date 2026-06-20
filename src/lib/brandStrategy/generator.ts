/**
 * Brand Strategy Generator
 * 
 * Main orchestrator for the complete brand strategy deduction chain.
 * 
 * DEDUCTION ORDER (LOCKED):
 * 1. Core Offerings ← menu + hours + signals
 * 2. Target Audience ← offerings + location + seasonality
 * 3. Communication Goal ← audience + business constraints
 * 4. [Occasion Profiles are runtime only, not generated here]
 */

import { supabase } from '../supabase';
import { BrandStrategy, StrategyDeductionInputs } from './types';
import { detectCoreOfferings } from './offeringsDetector';
import { deduceTargetAudience } from './audienceDeduction';
import { deduceCommunicationGoal } from './goalDeduction';
import { inferSeasonForDK } from './inferSeasonForDK';

/**
 * Infer takeaway availability from menu categories or metadata.
 */
function inferHasTakeaway(menuCategories: Record<string, number>, menuMeta?: any): boolean {
  // Prefer explicit metadata if you have it
  if (typeof menuMeta?.has_takeaway === "boolean") return menuMeta.has_takeaway;

  // Cheap heuristic from categories
  const keys = Object.keys(menuCategories).map(k => k.toLowerCase());
  const hints = ["takeaway", "take-away", "to go", "togo", "to-go", "delivery", "ud af huset", "afhentning"];
  return keys.some(k => hints.some(h => k.includes(h)));
}

function parsePriceToNumber(price: unknown): number | undefined {
  if (typeof price === "number") return price > 0 ? price : undefined;
  if (typeof price !== "string") return undefined;

  // Danish formats like: "199,-", "95 kr", "95,00 kr"
  const cleaned = price.replace(/[^0-9.,]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * Collect all input data from database tables.
 */
export async function collectStrategyInputs(businessId: string): Promise<StrategyDeductionInputs | null> {
  try {
    // Some tables used here may exist in the DB but are not represented in our generated TS types yet.
    // Use an untyped client for those specific queries to avoid blocking compilation.
    const untypedSupabase = supabase as any;

    // 1. Fetch business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (businessError || !business) {
      console.error('Failed to load business:', businessError);
      return null;
    }
    
    // NOTE: business_menu_metadata table was DROPPED April 2026 (migration 20260420000007).
    // Menu intelligence is now in menu_results_v2 and menu_items_normalized.
    const menuMeta = null;
    
    // 3. Fetch latest structured menu result (used for category + price signals)
    const { data: menuResult } = await supabase
      .from('menu_results_v2')
      .select('structured_data, created_at, status')
      .eq('business_id', businessId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // 4. Fetch opening hours
    const { data: hours } = await supabase
      .from('opening_hours')
      .select('*')
      .eq('business_id', businessId);
    
    // 5. Fetch location intelligence
    const { data: location } = await untypedSupabase
      .from('business_location_intelligence')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();
    
    // Process menu data
    const menuCategories: Record<string, number> = {};
    const prices: number[] = [];

    const structured = (menuResult as any)?.structured_data;
    if (structured?.categories && Array.isArray(structured.categories)) {
      structured.categories.forEach((cat: any) => {
        const name = (cat?.name ?? cat?.title ?? 'other');
        const categoryName = String(name).trim() || 'other';

        if (Array.isArray(cat?.items)) {
          menuCategories[categoryName] = (menuCategories[categoryName] || 0) + cat.items.length;
          cat.items.forEach((item: any) => {
            const maybePrice = parsePriceToNumber(item?.price);
            if (maybePrice != null) prices.push(maybePrice);
          });
        } else {
          // If we only have category names but no items, count the category once
          menuCategories[categoryName] = (menuCategories[categoryName] || 0) + 1;
        }
      });
    }

    const avgPrice = prices.length > 0
      ? (prices.reduce((a, b) => a + b, 0) / prices.length)
      : 100; // Default 100kr
    
    // Process opening hours
    const hoursData = processOpeningHours(hours || []);
    
    // Compute runtime context
    const now = new Date();
    const season = inferSeasonForDK(now);
    
    // Build inputs object
    const inputs: StrategyDeductionInputs = {
      menu: {
        categories: menuCategories,
        avgPrice,
        // @ts-ignore - Properties exist but types not yet regenerated
        hasAlcohol: menuMeta?.has_full_bar || menuMeta?.has_wine_list || false,
        hasTakeaway: inferHasTakeaway(menuCategories, menuMeta),
        // @ts-ignore
        foodPhilosophy: menuMeta?.food_philosophy,
        // @ts-ignore
        dietaryOptions: menuMeta?.dietary_options || [],
        // @ts-ignore
        hasSpecialtyCoffee: menuMeta?.has_specialty_coffee || false,
        // @ts-ignore
        hasWineList: menuMeta?.has_wine_list || false
      },
      hours: hoursData,
      location: {
        // @ts-ignore - Properties exist but types not yet regenerated
        areaType: location?.area_type || 'mixed_use',
        categoryScores: {}, // Will be populated below
        // @ts-ignore
        neighborhood: location?.neighborhood || '',
        // @ts-ignore
        marketingHooks: location?.location_marketing_hooks || [],
        scoreSource: "areaTypeOnly" as "areaTypeOnly" | "fullScores"
      },
      context: {
        season,
        generatedAt: now.toISOString()
      },
      businessType: (business as any).business_type || 'cafe',
      locale: (business as any).locale || 'da-DK'
    };
    
    // Location category scores: prefer full scores from DB, fallback to area_type
    // @ts-ignore
    if (location?.category_scores && typeof location.category_scores === "object") {
      // If you later store full scores in DB, use them here
      // @ts-ignore
      inputs.location.categoryScores = location.category_scores;
      inputs.location.scoreSource = "fullScores";
    } else if (location?.area_type) {
      // @ts-ignore
      inputs.location.categoryScores[location.area_type] = 100;
      inputs.location.scoreSource = "areaTypeOnly";
    }
    
    return inputs;
    
  } catch (error) {
    console.error('Error collecting strategy inputs:', error);
    return null;
  }
}

/**
 * Process opening hours into boolean patterns.
 */
function processOpeningHours(hours: any[]): StrategyDeductionInputs["hours"] {
  const patterns = {
    opensWeekdays: false,
    opensWeekends: false,
    hasBreakfast: false,
    hasLunch: false,
    hasDinner: false,
    hasLateNight: false
  };

  let openDays = 0;
  let breakfastDays = 0;
  let lunchDays = 0;
  let dinnerDays = 0;
  let lateNightDays = 0;

  const toMinutes = (t: string) => {
    const [hh, mm] = t.split(":").map((x: string) => parseInt(x, 10));
    return (hh * 60) + (mm || 0);
  };

  hours.forEach(h => {
    const day = h.day_of_week;
    const open = h.open_time;
    const close = h.close_time;

    if (!open || !close) return;

    openDays++;

    let openMin = toMinutes(open);
    let closeMin = toMinutes(close);

    // Handle overnight closing (e.g., 18:00 -> 02:00)
    if (closeMin <= openMin) closeMin += 24 * 60;

    // Check day patterns
    if (day >= 1 && day <= 5) patterns.opensWeekdays = true;
    if (day === 0 || day === 6) patterns.opensWeekends = true;

    // Day-level checks
    if (openMin <= 10 * 60) breakfastDays++;
    if (openMin <= 12 * 60 && closeMin >= 14 * 60) lunchDays++;
    if (closeMin >= 18 * 60) dinnerDays++;
    if (closeMin >= 22 * 60) lateNightDays++;
  });

  // Avoid "true because of 1 weird day":
  // require at least ~30% of open days (min 2 days) to set a pattern.
  const threshold = (count: number) => openDays >= 2 && count / openDays >= 0.3;

  patterns.hasBreakfast = threshold(breakfastDays);
  patterns.hasLunch = threshold(lunchDays);
  patterns.hasDinner = threshold(dinnerDays);
  patterns.hasLateNight = threshold(lateNightDays);

  return patterns;
}

/**
 * Generate complete brand strategy.
 * 
 * This executes the full deduction chain.
 */
export async function generateBrandStrategy(businessId: string): Promise<BrandStrategy | null> {
  console.log('🎯 Starting brand strategy generation for business:', businessId);
  
  // Step 1: Collect inputs
  console.log('📊 Collecting strategy inputs...');
  const inputs = await collectStrategyInputs(businessId);
  
  if (!inputs) {
    console.error('❌ Failed to collect strategy inputs');
    return null;
  }
  
  console.log('✅ Inputs collected:', {
    menuCategories: Object.keys(inputs.menu.categories).length,
    avgPrice: inputs.menu.avgPrice,
    businessType: inputs.businessType,
    areaType: inputs.location.areaType
  });
  
  // Step 2: Detect core offerings (LAYER 1: WHAT)
  console.log('🍽️ Detecting core offerings...');
  const coreOfferings = detectCoreOfferings(inputs);
  console.log('✅ Core offerings:', coreOfferings.offerings);
  
  // Step 3: Deduce target audience (LAYER 2: WHO)
  console.log('👥 Deducing target audience...');
  const targetAudience = deduceTargetAudience(coreOfferings, inputs);
  console.log('✅ Target audience:', targetAudience.primary);
  
  // Step 4: Deduce communication goal (LAYER 3: WHY)
  console.log('🎯 Deducing communication goal...');
  const communicationGoal = deduceCommunicationGoal(targetAudience, inputs);
  console.log('✅ Communication goal:', communicationGoal.goal);
  
  // Build complete strategy
  const strategy: BrandStrategy = {
    business_id: businessId,
    core_offerings: coreOfferings,
    target_audience: targetAudience,
    communication_goal: communicationGoal,
    locale: inputs.locale,
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    approved_by_user: false
  };
  
  console.log('✅ Brand strategy generated successfully');
  
  return strategy;
}

/**
 * Save brand strategy to database.
 */
export async function saveBrandStrategy(strategy: BrandStrategy): Promise<boolean> {
  try {
    // Transform for database storage
    const dbData = {
      business_id: strategy.business_id,
      // Core offerings
      core_offerings: strategy.core_offerings.offerings,
      offerings_weights: strategy.core_offerings.weights,
      offerings_reasoning: strategy.core_offerings.reasoning,
      offerings_confidence: strategy.core_offerings.confidence,
      // NEW: Save all candidates for explainability
      offerings_full: null, // offerings_full column dropped from business_brand_profile April 2026
      // Target audience
      target_audience_primary: strategy.target_audience.primary,
      target_audience_seasonal: strategy.target_audience.seasonal,
      audience_reasoning: strategy.target_audience.reasoning,
      audience_confidence: strategy.target_audience.confidence,
      // Communication goal
      communication_goal: strategy.communication_goal.goal,
      goal_reasoning: strategy.communication_goal.reasoning,
      goal_confidence: strategy.communication_goal.confidence,
      // Metadata
      strategy_version: strategy.version,
      generated_at: strategy.generated_at,
      approved_by_user: strategy.approved_by_user,
      updated_at: new Date().toISOString()
    };
    
    // @ts-ignore - New columns exist but types not yet regenerated after migration
    const { error } = await supabase
      .from('business_brand_profile')
      // @ts-ignore
      .upsert(dbData, {
        onConflict: 'business_id'
      });
    
    if (error) {
      console.error('❌ Failed to save brand strategy:', error);
      return false;
    }
    
    console.log('✅ Brand strategy saved successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error saving brand strategy:', error);
    return false;
  }
}
