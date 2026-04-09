/**
 * Concept Fit Analyzer
 * 
 * Evaluates how well a business concept fits its location type.
 * Provides actionable marketing guidance based on the match.
 */

import { getLocationExpectations, LocationExpectations } from './expectations';
import { 
  selectStrategyDriver, 
  getSeasonalRelevance, 
  getSeasonalWeight,
  type LocationMatch,
  type Season 
} from './seasonality';
import { t } from 'i18next';

export interface MenuPeriod {
  name: string; // e.g., "Brunch", "Lunch", "Dinner", "Afternoon Tea"
  type: 'breakfast' | 'brunch' | 'lunch' | 'afternoon' | 'dinner' | 'late_night' | 'all_day' | 'other';
  startTime: string; // HH:MM format (e.g., "09:00")
  endTime: string; // HH:MM format (e.g., "14:00")
  daysAvailable?: string[]; // ['monday', 'tuesday', etc.] - if omitted, assume all days
  items?: string[]; // Sample menu items from this period (for AI reference)
}

export interface ConceptFitInput {
  // Business data (ONLY these inputs - no reviews/ratings)
  aboutText?: string;
  openingHours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };
  menuPeriods?: MenuPeriod[]; // Structured menu timing data
  menuSummary?: string; // Deprecated - use menuPeriods instead
  serviceModel?: 'dine-in' | 'takeaway' | 'both' | 'delivery';
  priceLevel?: 'budget' | 'mid' | 'premium'; // or unknown
}

export interface ConceptFitOutput {
  area_type: string; // Which location category this fit is for
  category_score: number; // Original 0-100 score
  strategy_score: number; // matchScore × seasonalWeight
  seasonal_weight: number; // 0.5-1.0
  seasonal_relevance: 'high' | 'medium' | 'low';
  is_strategy_driver: boolean; // True if this is the selected strategy driver
  fit_level: 'strong' | 'moderate' | 'challenging';
  fit_confidence: number; // 0.0-1.0
  ui_summary: {
    one_liner: string; // One sentence: why this fit level
    best_marketing_angle: string; // Short phrase like "Speed + lunch bundles"
  };
  fit_reasons: string[]; // 2-4 short bullets (for AI only)
  marketing_implications: {
    content_emphasis: string[]; // 3-5 bullets
    cta_style: 'Friendly invite' | 'Direct action' | 'Community style';
    timing_tweaks: string[]; // 1-3 bullets
  };
  recommended_adjustments: Array<{
    type: 'offer' | 'content' | 'timing' | 'positioning';
    suggestion: string;
  }>;
  watchouts: string[]; // 0-3 short bullets (for AI only)
}

export class ConceptFitAnalyzer {
  
  /**
   * Analyze how well the business concept fits a specific location category
   * Conservative bias toward Moderate if uncertain
   */
  analyzeForCategory(
    categoryId: string, 
    categoryScore: number, 
    categoryDisplayName: string,
    input: ConceptFitInput,
    season?: Season,
    isStrategyDriver: boolean = false
  ): ConceptFitOutput {
    const expectations = getLocationExpectations(categoryId);
    
    if (!expectations) {
      return this.getDefaultFit(categoryId, categoryScore, categoryDisplayName, season, isStrategyDriver);
    }
    
    // Calculate seasonal metrics
    const seasonalWeight = getSeasonalWeight(categoryId, season);
    const strategyScore = categoryScore * seasonalWeight;
    const seasonalRelevance = getSeasonalRelevance(categoryId, season);
    
    // Evaluate 3 dimensions
    const hoursFit = this.evaluateHoursFit(input.openingHours, input.menuPeriods, expectations);
    const priceFit = this.evaluatePriceFit(input.priceLevel, expectations);
    const serviceFit = this.evaluateServiceFit(input.serviceModel, input.menuPeriods, input.menuSummary, expectations);
    
    // Determine overall fit level (conservative toward Moderate)
    const { fitLevel, confidence } = this.determineFitLevel(hoursFit, priceFit, serviceFit);
    
    // Generate user-facing summary
    const uiSummary = this.generateUISummary(fitLevel, categoryDisplayName, hoursFit, priceFit, serviceFit, expectations);
    
    // Generate internal analysis for AI
    const fitReasons = this.generateFitReasons(hoursFit, priceFit, serviceFit);
    const marketingImplications = this.generateMarketingImplications(fitLevel, expectations, hoursFit, priceFit, serviceFit);
    const recommendedAdjustments = this.generateAdjustments(fitLevel, hoursFit, priceFit, serviceFit, expectations);
    const watchouts = this.generateWatchouts(fitLevel, hoursFit, priceFit, serviceFit, expectations);
    
    return {
      area_type: categoryId,
      category_score: categoryScore,
      strategy_score: strategyScore,
      seasonal_weight: seasonalWeight,
      seasonal_relevance: seasonalRelevance,
      is_strategy_driver: isStrategyDriver,
      fit_level: fitLevel,
      fit_confidence: confidence,
      ui_summary: uiSummary,
      fit_reasons: fitReasons,
      marketing_implications: marketingImplications,
      recommended_adjustments: recommendedAdjustments,
      watchouts: watchouts
    };
  }
  
  /**
   * Dimension 1: Hours Fit
   * Do opening hours AND menu periods cover the area's main demand windows?
   */
  private evaluateHoursFit(
    hours: ConceptFitInput['openingHours'],
    menuPeriods: ConceptFitInput['menuPeriods'],
    expectations: LocationExpectations
  ): { score: 'good' | 'moderate' | 'poor'; details: string } {
    if (!hours) {
      return { score: 'moderate', details: t('conceptFit.hours.not_provided') };
    }
    
    const categoryId = expectations.categoryId;
    
    // Office/Business District: needs weekday mornings + lunch
    if (categoryId === 'office') {
      const hasWeekdayMorning = this.isOpenDuring(hours, 'weekday', '08:00', '10:00');
      const hasWeekdayLunch = this.isOpenDuring(hours, 'weekday', '11:30', '14:00');
      
      // Check if they have a lunch menu during lunch hours
      const hasLunchMenu = menuPeriods?.some(period => 
        period.type === 'lunch' && 
        period.startTime <= '12:00' && 
        period.endTime >= '13:00'
      );
      
      if (!hasWeekdayMorning && !hasWeekdayLunch) {
        return { score: 'poor', details: t('conceptFit.hours.missing_office_hours') };
      }
      if (!hasWeekdayLunch) {
        return { score: 'moderate', details: t('conceptFit.hours.too_late_for_lunch') };
      }
      if (hasLunchMenu) {
        return { score: 'good', details: t('conceptFit.hours.perfect_office_lunch') };
      }
      return { score: 'good', details: t('conceptFit.hours.good_office_match') };
    }
    
    // Transport Hub: needs early/late + continuous + grab-and-go options
    if (categoryId === 'transport_hub') {
      const hasEarlyHours = this.isOpenDuring(hours, 'weekday', '06:00', '08:00');
      const hasBreakfastMenu = menuPeriods?.some(period =>
        period.type === 'breakfast' && period.startTime <= '07:00'
      );
      
      if (!hasEarlyHours) {
        return { score: 'moderate', details: t('conceptFit.hours.commuters_need_early') };
      }
      if (hasBreakfastMenu) {
        return { score: 'good', details: t('conceptFit.hours.perfect_commuter_morning') };
      }
      return { score: 'good', details: t('conceptFit.hours.covers_commuter_times') };
    }
    
    // Student: needs weekday evenings + late dinner
    if (categoryId === 'student') {
      const hasEvenings = this.isOpenDuring(hours, 'weekday', '18:00', '21:00');
      const hasDinnerMenu = menuPeriods?.some(period =>
        period.type === 'dinner' && period.endTime >= '21:00'
      );
      
      if (!hasEvenings) {
        return { score: 'moderate', details: t('conceptFit.hours.students_need_evenings') };
      }
      if (hasDinnerMenu) {
        return { score: 'good', details: t('conceptFit.hours.perfect_student_evening') };
      }
      return { score: 'good', details: t('conceptFit.hours.evening_suits_students') };
    }
    
    // Waterfront/Tourist: needs weekends + brunch/afternoon options
    if (categoryId === 'waterfront' || categoryId === 'tourist') {
      const hasWeekendAfternoons = this.isOpenDuring(hours, 'weekend', '12:00', '17:00');
      const hasBrunchMenu = menuPeriods?.some(period =>
        period.type === 'brunch' && period.endTime >= '14:00'
      );
      
      if (!hasWeekendAfternoons) {
        return { score: 'moderate', details: t('conceptFit.hours.missing_weekend_afternoons') };
      }
      if (hasBrunchMenu) {
        return { score: 'good', details: t('conceptFit.hours.perfect_weekend_brunch') };
      }
      return { score: 'good', details: t('conceptFit.hours.catches_weekend_visitors') };
    }
    
    // Destination: flexible timing (planned visits) + check for special menus
    if (categoryId === 'destination') {
      const hasSpecialMenus = menuPeriods && menuPeriods.length > 1;
      if (hasSpecialMenus) {
        return { score: 'good', details: t('conceptFit.hours.multiple_periods_destination') };
      }
      return { score: 'good', details: t('conceptFit.hours.flexible_destination') };
    }
    
    return { score: 'moderate', details: t('conceptFit.hours.acceptable') };
  }
  
  /**
   * Dimension 2: Price Fit
   * Does pricing fit the area's typical tolerance?
   */
  private evaluatePriceFit(
    priceLevel: ConceptFitInput['priceLevel'],
    expectations: LocationExpectations
  ): { score: 'good' | 'moderate' | 'poor'; details: string } {
    if (!priceLevel) {
      return { score: 'moderate', details: t('conceptFit.price.unclear') };
    }
    
    const categoryId = expectations.categoryId;
    const priceSensitivity = expectations.audienceBehavior.pricesensitivity;
    
    // Student area + premium = challenging but not impossible
    if (categoryId === 'student' && priceLevel === 'premium') {
      return { score: 'moderate', details: t('conceptFit.price.premium_student_area') };
    }
    
    // Office/City + budget = works for volume
    if ((categoryId === 'office' || categoryId === 'city_centre') && priceLevel === 'budget') {
      return { score: 'good', details: t('conceptFit.price.budget_high_volume') };
    }
    
    // Destination + premium = good match
    if (categoryId === 'destination' && priceLevel === 'premium') {
      return { score: 'good', details: t('conceptFit.price.premium_destination') };
    }
    
    // High price sensitivity area + premium
    if (priceSensitivity === 'high' && priceLevel === 'premium') {
      return { score: 'moderate', details: t('conceptFit.price.high_focus_value') };
    }
    
    // Medium price sensitivity + mid pricing
    if (priceSensitivity === 'medium' && priceLevel === 'mid') {
      return { score: 'good', details: t('conceptFit.price.good_match') };
    }
    
    return { score: 'moderate', details: t('conceptFit.price.acceptable') };
  }
  
  /**
   * Dimension 3: Service Style Fit
   * Does service model suit the area's flow? Consider menu periods for additional context.
   */
  private evaluateServiceFit(
    serviceModel: ConceptFitInput['serviceModel'],
    menuPeriods: ConceptFitInput['menuPeriods'],
    menuSummary: string | undefined,
    expectations: LocationExpectations
  ): { score: 'good' | 'moderate' | 'poor'; details: string } {
    if (!serviceModel) {
      return { score: 'moderate', details: t('conceptFit.service.unclear') };
    }
    
    const categoryId = expectations.categoryId;
    const speedExpectation = expectations.serviceExpectations.speed;
    
    // Transport hub needs grab-and-go
    if (categoryId === 'transport_hub') {
      if (serviceModel === 'takeaway' || serviceModel === 'both') {
        return { score: 'good', details: t('conceptFit.service.takeaway_commuters') };
      }
      return { score: 'poor', details: t('conceptFit.service.hub_needs_quick') };
    }
    
    // Office benefits from takeaway + fast lunch options
    if (categoryId === 'office') {
      const hasLunchMenu = menuPeriods?.some(p => p.type === 'lunch');
      
      if (serviceModel === 'both') {
        if (hasLunchMenu) {
          return { score: 'good', details: t('conceptFit.service.perfect_office_both') };
        }
        return { score: 'good', details: t('conceptFit.service.office_both_good') };
      }
      if (serviceModel === 'dine-in' && speedExpectation === 'fast') {
        return { score: 'moderate', details: t('conceptFit.service.lunch_needs_speed') };
      }
      return { score: 'moderate', details: t('conceptFit.service.acceptable') };
    }
    
    // Destination: dine-in is expected + multiple menu periods adds value
    if (categoryId === 'destination') {
      const hasMultipleMenus = menuPeriods && menuPeriods.length > 1;
      
      if (serviceModel === 'dine-in') {
        if (hasMultipleMenus) {
          return { score: 'good', details: t('conceptFit.service.perfect_destination_multi') };
        }
        return { score: 'good', details: t('conceptFit.service.destination_experience') };
      }
    }
    
    return { score: 'moderate', details: t('conceptFit.service.works') };
  }
  
  /**
   * Determine overall fit level from 3 dimensions
   * Conservative bias toward Moderate
   */
  private determineFitLevel(
    hoursFit: { score: string },
    priceFit: { score: string },
    serviceFit: { score: string }
  ): { fitLevel: 'strong' | 'moderate' | 'challenging'; confidence: number } {
    const scores = [hoursFit.score, priceFit.score, serviceFit.score];
    
    const goodCount = scores.filter(s => s === 'good').length;
    const poorCount = scores.filter(s => s === 'poor').length;
    
    // Strong: all 3 good or 2 good + 1 moderate
    if (goodCount === 3) {
      return { fitLevel: 'strong', confidence: 0.9 };
    }
    if (goodCount === 2 && poorCount === 0) {
      return { fitLevel: 'strong', confidence: 0.75 };
    }
    
    // Challenging: 2+ poor
    if (poorCount >= 2) {
      return { fitLevel: 'challenging', confidence: 0.8 };
    }
    
    // Moderate: everything else (conservative default)
    return { fitLevel: 'moderate', confidence: 0.7 };
  }
  
  /**
   * Generate user-friendly summary (one-liner + marketing angle)
   */
  private generateUISummary(
    fitLevel: 'strong' | 'moderate' | 'challenging',
    categoryDisplayName: string,
    hoursFit: { score: string; details: string },
    priceFit: { score: string; details: string },
    serviceFit: { score: string; details: string },
    expectations: LocationExpectations
  ): { one_liner: string; best_marketing_angle: string } {
    const categoryName = categoryDisplayName; // Use actual category name from UI
    
    if (fitLevel === 'strong') {
      return {
        one_liner: t('conceptFit.ui.strong_one_liner', { category: categoryName }),
        best_marketing_angle: this.getBestAngle(expectations, 'strong')
      };
    }
    
    if (fitLevel === 'challenging') {
      const mainIssueKey = hoursFit.score === 'poor'
        ? 'conceptFit.ui.issue.adjust_hours'
        : priceFit.score === 'moderate'
        ? 'conceptFit.ui.issue.strengthen_value'
        : 'conceptFit.ui.issue.adjust_service';

      return {
        one_liner: t('conceptFit.ui.challenging_one_liner', { issue: t(mainIssueKey), category: categoryName }),
        best_marketing_angle: t('conceptFit.ui.challenging_best_angle')
      };
    }
    
    // Moderate
    return {
      one_liner: t('conceptFit.ui.moderate_one_liner', { category: categoryName }),
      best_marketing_angle: this.getBestAngle(expectations, 'moderate')
    };
  }
  
  private getBestAngle(expectations: LocationExpectations, fitLevel: string): string {
    const angles = expectations.winningAngles;
    
    if (fitLevel === 'strong') {
      return `${angles[0]} + ${angles[1] || t('conceptFit.fallback.quality')}`;
    }
    
    return `${angles[1] || t('conceptFit.fallback.quality')} + ${angles[2] || t('conceptFit.fallback.value')}`;
  }
  
  /**
   * Generate 2-4 short fit reasons
   */
  private generateFitReasons(
    hoursFit: { details: string },
    priceFit: { details: string },
    serviceFit: { details: string }
  ): string[] {
    return [
      hoursFit.details,
      priceFit.details,
      serviceFit.details
    ].filter(d => d && d !== 'Acceptabel timing' && d !== 'Acceptabel' && d !== 'Fungerer');
  }
  
  /**
   * Generate marketing implications for AI
   */
  private generateMarketingImplications(
    fitLevel: string,
    expectations: LocationExpectations,
    hoursFit: { score: string },
    priceFit: { score: string },
    serviceFit: { score: string }
  ): ConceptFitOutput['marketing_implications'] {
    const contentEmphasis: string[] = [];
    const timingTweaks: string[] = [];
    
    // Content emphasis based on fit
    if (fitLevel === 'strong') {
      contentEmphasis.push(t('conceptFit.marketing.strong_1'));
      contentEmphasis.push(t('conceptFit.marketing.strong_2'));
      contentEmphasis.push(t('conceptFit.marketing.strong_3'));
    } else if (fitLevel === 'moderate') {
      contentEmphasis.push(t('conceptFit.marketing.moderate_1'));
      contentEmphasis.push(t('conceptFit.marketing.moderate_2'));
      contentEmphasis.push(t('conceptFit.marketing.moderate_3'));
    } else {
      contentEmphasis.push(t('conceptFit.marketing.challenging_1'));
      contentEmphasis.push(t('conceptFit.marketing.challenging_2'));
      contentEmphasis.push(t('conceptFit.marketing.challenging_3'));
    }
    
    // Add area-specific emphasis
    contentEmphasis.push(...expectations.winningAngles.slice(0, 2));
    
    // Timing tweaks
    if (hoursFit.score === 'moderate' || hoursFit.score === 'poor') {
      timingTweaks.push(t('conceptFit.timing.adjust'));
    }
    if (expectations.categoryId === 'waterfront' || expectations.categoryId === 'tourist') {
      timingTweaks.push(t('conceptFit.timing.seasonal_focus'));
    }
    if (expectations.categoryId === 'destination') {
      timingTweaks.push(t('conceptFit.timing.reservation_info'));
    }
    
    // CTA style
    let ctaStyle: ConceptFitOutput['marketing_implications']['cta_style'] = 'Friendly invite';
    if (expectations.categoryId === 'transport_hub' || expectations.categoryId === 'office' || expectations.categoryId === 'destination') {
      ctaStyle = 'Direct action';
    } else if (expectations.categoryId === 'residential') {
      ctaStyle = 'Community style';
    }
    
    return {
      content_emphasis: contentEmphasis.slice(0, 5),
      cta_style: ctaStyle,
      timing_tweaks: timingTweaks.slice(0, 3)
    };
  }
  
  /**
   * Generate recommended adjustments
   */
  private generateAdjustments(
    fitLevel: string,
    hoursFit: { score: string; details: string },
    priceFit: { score: string; details: string },
    serviceFit: { score: string },
    expectations: LocationExpectations
  ): ConceptFitOutput['recommended_adjustments'] {
    const adjustments: ConceptFitOutput['recommended_adjustments'] = [];
    
    if (fitLevel !== 'strong') {
      if (hoursFit.score === 'poor' || hoursFit.score === 'moderate') {
        adjustments.push({
          type: 'timing',
          suggestion: t('conceptFit.adjust.timing')
        });
      }
      
      if (priceFit.score === 'moderate') {
        adjustments.push({
          type: 'positioning',
          suggestion: t('conceptFit.adjust.positioning')
        });
      }
      
      if (serviceFit.score === 'poor') {
        adjustments.push({
          type: 'offer',
          suggestion: t('conceptFit.adjust.service')
        });
      }
      
      if (expectations.categoryId === 'student' && priceFit.score !== 'good') {
        adjustments.push({
          type: 'offer',
          suggestion: t('conceptFit.adjust.student')
        });
      }
      
      if (expectations.categoryId === 'destination') {
        adjustments.push({
          type: 'positioning',
          suggestion: t('conceptFit.adjust.destination_positioning')
        });
        adjustments.push({
          type: 'offer',
          suggestion: t('conceptFit.adjust.destination_offer')
        });
      }
    }
    
    return adjustments;
  }
  
  /**
   * Generate watchouts (0-3 bullets)
   */
  private generateWatchouts(
    fitLevel: string,
    hoursFit: { score: string },
    priceFit: { score: string },
    serviceFit: { score: string },
    expectations: LocationExpectations
  ): string[] {
    const watchouts: string[] = [];
    
    if (fitLevel === 'challenging') {
      watchouts.push(t('conceptFit.watchout.challenging'));
    }
    
    if (expectations.categoryId === 'tourist' || expectations.categoryId === 'waterfront') {
      watchouts.push(t('conceptFit.watchout.seasonal'));
    }
    
    if (priceFit.score === 'poor') {
      watchouts.push(t('conceptFit.watchout.price'));
    }
    
    if (hoursFit.score === 'poor') {
      watchouts.push(t('conceptFit.watchout.hours'));
    }
    
    return watchouts.slice(0, 3);
  }
  
  /**
   * Helper: Check if open during specific period
   */
  private isOpenDuring(
    hours: ConceptFitInput['openingHours'],
    dayType: 'weekday' | 'weekend',
    startTime: string,
    endTime: string
  ): boolean {
    if (!hours) return false;
    
    const daysToCheck = dayType === 'weekday' 
      ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      : ['saturday', 'sunday'];
    
    const daysOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

    const parseMinutes = (t: string | undefined | null): number | null => {
      if (!t) return null;
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (isNaN(hh) || isNaN(mm)) return null;
      return hh * 60 + mm;
    }

    // Normalize query period (allow overnight queries)
    let qStart = parseMinutes(startTime);
    let qEnd = parseMinutes(endTime);
    if (qStart === null || qEnd === null) return false;
    if (qEnd <= qStart) qEnd += 24 * 60; // overnight query

    return daysToCheck.some(day => {
      const dayHours = hours[day as keyof typeof hours] as any;
      if (!dayHours) return false;

      const ranges: Array<[number, number]> = [];

      // Current day's hours
      const openMin = parseMinutes(dayHours.open);
      const closeMin = parseMinutes(dayHours.close);
      if (openMin !== null && closeMin !== null) {
        if (closeMin <= openMin) {
          // overnight span from this day into next (e.g., 22:00-03:00)
          ranges.push([openMin, closeMin + 24 * 60]);
        } else {
          ranges.push([openMin, closeMin]);
        }
      }

      // Also consider previous day's overnight spill (e.g., prev day 22:00-03:00 covers current day's early hours)
      const dayIdx = daysOrder.indexOf(day);
      const prevDay = daysOrder[(dayIdx + 6) % 7];
      const prevHours = hours[prevDay as keyof typeof hours] as any;
      if (prevHours) {
        const prevOpen = parseMinutes(prevHours.open);
        const prevClose = parseMinutes(prevHours.close);
        if (prevOpen !== null && prevClose !== null && prevClose <= prevOpen) {
          // previous day's overnight range spills into this day
          ranges.push([prevOpen, prevClose + 24 * 60]);
        }
      }

      // Check if query fits entirely inside any available range
      for (const [rStart, rEnd] of ranges) {
        // Try matching query at base day and shifted +24h (to compare against overnight ranges)
        if (rStart <= qStart && rEnd >= qEnd) return true;
        if (rStart <= qStart + 24 * 60 && rEnd >= qEnd + 24 * 60) return true;
      }

      return false;
    });
  }
  

  
  /**
   * Fallback for unknown location types
   */
  private getDefaultFit(
    areaType: string, 
    categoryScore: number, 
    categoryDisplayName: string,
    season?: Season,
    isStrategyDriver: boolean = false
  ): ConceptFitOutput {
    const seasonalWeight = getSeasonalWeight(areaType, season);
    const strategyScore = categoryScore * seasonalWeight;
    const seasonalRelevance = getSeasonalRelevance(areaType, season);
    
    return {
      area_type: areaType,
      category_score: categoryScore,
      strategy_score: strategyScore,
      seasonal_weight: seasonalWeight,
      seasonal_relevance: seasonalRelevance,
      is_strategy_driver: isStrategyDriver,
      fit_level: 'moderate',
      fit_confidence: 0.5,
      ui_summary: {
        one_liner: t('conceptFit.ui.default_one_liner'),
        best_marketing_angle: t('conceptFit.ui.default_best_angle')
      },
      fit_reasons: [t('conceptFit.default_reason')],
      marketing_implications: {
        content_emphasis: ['Kvalitet', 'Service', 'Værdi'],
        cta_style: 'Friendly invite',
        timing_tweaks: []
      },
      recommended_adjustments: [],
      watchouts: []
    };
  }
}

/**
 * Convenience function for running concept fit analysis on multiple categories
 * Selects ONE strategy driver based on strategyScore (matchScore × seasonalWeight)
 * 
 * @param categories - Array of {categoryId, score, displayName} from location analysis
 * @param input - Business data (hours, menu, pricing, etc.)
 * @param season - Optional season override (default: current season)
 * @returns Object keyed by categoryId with ConceptFitOutput for each
 */
export function analyzeConceptFit(
  categories: Array<{categoryId: string; score: number; displayName: string}>,
  input: ConceptFitInput,
  season?: Season
): Record<string, ConceptFitOutput> {
  const analyzer = new ConceptFitAnalyzer();
  const results: Record<string, ConceptFitOutput> = {};
  
  // Filter categories >= 60% and prepare as LocationMatch
  const eligibleCategories = categories.filter(cat => cat.score >= 60);
  
  if (eligibleCategories.length === 0) {
    return results;
  }
  
  // Convert to LocationMatch format for strategy driver selection
  const matches: LocationMatch[] = eligibleCategories.map(cat => ({
    categoryId: cat.categoryId,
    matchScore: cat.score,
    displayName: cat.displayName
  }));
  
  // Select strategy driver (highest strategyScore = matchScore × seasonalWeight)
  const driver = selectStrategyDriver(matches, season);
  const driverCategoryId = driver?.categoryId;
  
  console.log(`🎯 Analyzing concept fit for ${eligibleCategories.length} categories (>= 60%)`);
  console.log(`📍 Strategy Driver: ${driver?.displayName} (strategy score: ${driver?.strategyScore.toFixed(1)})`);
  
  // Analyze all eligible categories
  for (const category of eligibleCategories) {
    const isDriver = category.categoryId === driverCategoryId;
    
    results[category.categoryId] = analyzer.analyzeForCategory(
      category.categoryId,
      category.score,
      category.displayName,
      input,
      season,
      isDriver
    );
  }
  
  return results;
}

