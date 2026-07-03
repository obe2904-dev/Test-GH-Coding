/**
 * TIMING INTELLIGENCE MODULE
 * 
 * Context-driven post timing recommendations based on:
 * - Weather patterns (outdoor seating opportunity)
 * - Event proximity (booking lead days)
 * - Service period decision windows
 * - Booking behavior (reservation_required, walk-in friendly)
 * - Business operations (opening hours, service periods)
 * 
 * Output: suggested_post_date, suggested_post_time, timing_rationale, lead_days
 */

import type { WeekContext } from '../types/strategy-types.ts';

export interface TimingRecommendation {
  suggested_post_date: string; // ISO date string (YYYY-MM-DD)
  suggested_post_time: string; // Time of day (HH:MM format)
  timing_rationale: string; // Why this timing
  lead_days: number; // Days before target visit
  target_visit_date?: string; // When we expect the customer to visit (ISO date)
  decision_window: 'same_day' | 'next_day' | 'advance_planning'; // Customer decision behavior
}

interface TimingContext {
  // Post characteristics
  service_period: 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'bar' | 'all_day';
  content_category: string; // 'product_menu', 'craving_visual', etc.
  goal_mode: 'drive_footfall' | 'build_brand' | 'retain_loyalty';
  
  // Week context
  weekContext: WeekContext;
  available_days: string[]; // ISO dates of days business is open
  
  // Event context
  event_proximity?: {
    event_name: string;
    event_date: string; // ISO date
    days_until: number;
  };
}

/**
 * Generate timing recommendation for a post based on context
 */
export function generateTimingRecommendation(ctx: TimingContext): TimingRecommendation {
  const {
    service_period,
    content_category,
    goal_mode,
    weekContext,
    available_days,
    event_proximity
  } = ctx;

  // Extract booking model from weekContext - check both booking_link and cta_rules
  const hasBookingLink = !!(weekContext as any).booking_link;
  const ctaRules = (weekContext as any).cta_rules || {};
  const acceptsWalkIns = ctaRules.mode === 'mixed' || ctaRules.mode === 'walk_in_only' || true;
  const reservationRequired = ctaRules.mode === 'reservation_only' || false;

  // Extract location intelligence
  const location = (weekContext as any).location || {};
  const hasOutdoorSeating = location.has_outdoor_seating || false;
  
  // Extract weather intelligence from week weather data
  const weather = (weekContext as any).weather || {};
  const weatherDays = weather.days || [];
  
  // Check if week has premium outdoor weather (temp 22-28°C, low precip)
  const hasPremiumOutdoorWeather = weatherDays.some((day: any) => {
    const temp = day.temp_max || day.temperature_max || 15;
    const precip = day.precipitation_probability || day.precip_prob || 100;
    return temp >= 22 && temp <= 28 && precip <= 20;
  });

  // Event-driven timing (highest priority)
  if (event_proximity && event_proximity.days_until <= 6) {
    return generateEventDrivenTiming(event_proximity, service_period, hasBookingLink, reservationRequired, available_days);
  }

  // Weather-driven timing (outdoor seating + good weather)
  if (hasOutdoorSeating && hasPremiumOutdoorWeather && goal_mode === 'drive_footfall') {
    return generateWeatherDrivenTiming(service_period, weekContext, available_days, acceptsWalkIns, hasBookingLink);
  }

  // Service period decision windows (default behavior)
  return generateServicePeriodTiming(service_period, goal_mode, acceptsWalkIns, hasBookingLink, reservationRequired, available_days, weekContext);
}

/**
 * Event-driven timing: Valentine's Day Wednesday → booking post Monday
 */
function generateEventDrivenTiming(
  event: { event_name: string; event_date: string; days_until: number },
  service_period: string,
  hasBookingLink: boolean,
  reservationRequired: boolean,
  available_days: string[]
): TimingRecommendation {
  const eventDate = new Date(event.event_date);
  const eventDayOfWeek = eventDate.getDay(); // 0=Sunday, 3=Wednesday

  // For dinner events, post 2-3 days before if booking is available
  if ((service_period === 'dinner' || service_period === 'all_day') && hasBookingLink) {
    const leadDays = reservationRequired ? 3 : 2; // Reservation-only businesses need more lead time
    const postDate = new Date(eventDate);
    postDate.setDate(postDate.getDate() - leadDays);
    
    // Find nearest available day
    const postDateISO = postDate.toISOString().split('T')[0];
    const nearestDay = findNearestAvailableDay(postDateISO, available_days);
    
    const postTime = service_period === 'dinner' ? '14:00' : '12:00'; // Afternoon for dinner planning
    
    return {
      suggested_post_date: nearestDay,
      suggested_post_time: postTime,
      timing_rationale: `${event.event_name} er ${event.days_until} dage væk. Poster ${leadDays} dage før for at give gæster tid til at booke bord til ${service_period}.`,
      lead_days: leadDays,
      target_visit_date: event.event_date,
      decision_window: 'advance_planning'
    };
  }

  // For events without booking, post 1 day before to build awareness
  const oneDayBefore = new Date(eventDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  const oneDayBeforeISO = oneDayBefore.toISOString().split('T')[0];
  const postDay = findNearestAvailableDay(oneDayBeforeISO, available_days);

  return {
    suggested_post_date: postDay,
    suggested_post_time: '18:00',
    timing_rationale: `${event.event_name} er i morgen. Poster aftenen før for at minde gæster om walk-in mulighed.`,
    lead_days: 1,
    target_visit_date: event.event_date,
    decision_window: 'next_day'
  };
}

/**
 * Weather-driven timing: Summer Saturday + outdoor seating → post Thursday/Friday
 */
function generateWeatherDrivenTiming(
  service_period: string,
  weekContext: WeekContext,
  available_days: string[],
  acceptsWalkIns: boolean,
  hasBookingLink: boolean
): TimingRecommendation {
  const weather = (weekContext as any).weather || {};
  const days = weather.days || [];
  
  // Find the best outdoor day this week
  let bestDay: any = null;
  let bestScore = 0;
  
  for (const day of days) {
    const score = calculateOutdoorScore(day);
    if (score > bestScore) {
      bestScore = score;
      bestDay = day;
    }
  }

  if (!bestDay) {
    // Fallback to service period timing
    return generateServicePeriodTiming(service_period, 'drive_footfall', acceptsWalkIns, hasBookingLink, false, available_days, weekContext);
  }

  const targetDate = bestDay.date;
  const targetDayOfWeek = new Date(targetDate).getDay(); // 0=Sunday, 6=Saturday
  
  // Weekend outdoor opportunity (Sat/Sun) → post Thu/Fri
  if (targetDayOfWeek === 6 || targetDayOfWeek === 0) {
    const isWeekend = true;
    const leadDays = hasBookingLink ? 2 : 1; // If booking available, post 2 days ahead
    
    const postDate = new Date(targetDate);
    postDate.setDate(postDate.getDate() - leadDays);
    const postDateISO = postDate.toISOString().split('T')[0];
    const nearestDay = findNearestAvailableDay(postDateISO, available_days);
    
    const postTime = hasBookingLink ? '16:00' : '11:00'; // Afternoon if booking, morning if walk-in
    const ctaType = hasBookingLink ? 'booking CTA' : 'walk-in CTA';
    
    return {
      suggested_post_date: nearestDay,
      suggested_post_time: postTime,
      timing_rationale: `${getDayName(targetDayOfWeek)} har fantastisk terrassevejr (${Math.round(bestDay.temp_max)}°C). Poster ${leadDays} ${leadDays === 1 ? 'dag' : 'dage'} før med ${ctaType} for udeservering.`,
      lead_days: leadDays,
      target_visit_date: targetDate,
      decision_window: leadDays > 1 ? 'advance_planning' : 'next_day'
    };
  }

  // Weekday outdoor opportunity → post same day or day before
  const leadDays = acceptsWalkIns ? 0 : 1; // Walk-in = same day, booking = day before
  const postDate = new Date(targetDate);
  if (leadDays > 0) {
    postDate.setDate(postDate.getDate() - leadDays);
  }
  const postDateISO = postDate.toISOString().split('T')[0];
  const nearestDay = findNearestAvailableDay(postDateISO, available_days);
  
  const postTime = leadDays === 0 ? '09:00' : '18:00'; // Morning same-day, evening day-before
  
  return {
    suggested_post_date: nearestDay,
    suggested_post_time: postTime,
    timing_rationale: `${getDayName(targetDayOfWeek)} har godt terrassevejr. Poster ${leadDays === 0 ? 'samme dag kl. 09:00' : 'aftenen før'} for spontane besøg.`,
    lead_days: leadDays,
    target_visit_date: targetDate,
    decision_window: leadDays === 0 ? 'same_day' : 'next_day'
  };
}

/**
 * Service period decision windows (default behavior)
 */
function generateServicePeriodTiming(
  service_period: string,
  goal_mode: string,
  acceptsWalkIns: boolean,
  hasBookingLink: boolean,
  reservationRequired: boolean,
  available_days: string[],
  weekContext: WeekContext
): TimingRecommendation {
  // Default: spread posts across week, use middle days
  const midWeekDay = available_days[Math.floor(available_days.length / 2)];
  
  // Lunch: Post evening before (18:00) or morning same-day (10:00-11:00)
  if (service_period === 'lunch') {
    const sameDayPost = acceptsWalkIns && goal_mode === 'drive_footfall';
    const postTime = sameDayPost ? '10:00' : '18:00';
    const leadDays = sameDayPost ? 0 : 1;
    const rationale = sameDayPost 
      ? 'Frokostgæster beslutter sig samme morgen. Poster kl. 10:00 for walk-in frokost.'
      : 'Frokostgæster planlægger aftenen før. Poster kl. 18:00 for næste dags frokost.';
    
    return {
      suggested_post_date: midWeekDay,
      suggested_post_time: postTime,
      timing_rationale: rationale,
      lead_days: leadDays,
      decision_window: sameDayPost ? 'same_day' : 'next_day'
    };
  }

  // Dinner: Post 1-2 days before (afternoon 14:00-16:00)
  if (service_period === 'dinner') {
    const leadDays = hasBookingLink ? 2 : 1;
    const postDate = new Date(midWeekDay);
    postDate.setDate(postDate.getDate() - leadDays);
    const postDateISO = postDate.toISOString().split('T')[0];
    const nearestDay = findNearestAvailableDay(postDateISO, available_days);
    
    const rationale = hasBookingLink
      ? `Aftensgæster booker ${leadDays} dage før. Poster eftermiddag med booking CTA.`
      : 'Aftensgæster planlægger dagen før. Poster eftermiddag.';
    
    return {
      suggested_post_date: nearestDay,
      suggested_post_time: '14:00',
      timing_rationale: rationale,
      lead_days: leadDays,
      decision_window: 'advance_planning'
    };
  }

  // Bar: Post same day afternoon (16:00-18:00)
  if (service_period === 'bar') {
    return {
      suggested_post_date: midWeekDay,
      suggested_post_time: '16:00',
      timing_rationale: 'Bar-gæster beslutter sig spontant samme eftermiddag. Poster kl. 16:00 for aftenstemning.',
      lead_days: 0,
      decision_window: 'same_day'
    };
  }

  // Breakfast/Brunch: Post evening before (20:00) or early morning (08:00)
  if (service_period === 'breakfast' || service_period === 'brunch') {
    const isWeekend = new Date(midWeekDay).getDay() === 0 || new Date(midWeekDay).getDay() === 6;
    const leadDays = isWeekend && hasBookingLink ? 1 : 0;
    const postTime = leadDays > 0 ? '20:00' : '08:00';
    const rationale = leadDays > 0
      ? 'Weekend brunch planlagt aftenen før. Poster kl. 20:00.'
      : 'Brunch-gæster beslutter sig samme morgen. Poster kl. 08:00.';
    
    return {
      suggested_post_date: midWeekDay,
      suggested_post_time: postTime,
      timing_rationale: rationale,
      lead_days: leadDays,
      decision_window: leadDays > 0 ? 'next_day' : 'same_day'
    };
  }

  // All-day / Brand posts: Mid-morning (11:00) for maximum reach
  return {
    suggested_post_date: midWeekDay,
    suggested_post_time: '11:00',
    timing_rationale: goal_mode === 'build_brand' 
      ? 'Brand-post til maksimal rækkevidde. Poster kl. 11:00 midt på dagen.'
      : 'Generel post. Poster formiddag for god synlighed.',
    lead_days: 0,
    decision_window: 'same_day'
  };
}

/**
 * Calculate outdoor comfort score for a weather day
 */
function calculateOutdoorScore(day: any): number {
  const temp = day.temp_max ?? day.feels_like ?? 15;
  const precip = day.precipitation_chance ?? 0;
  const wind = day.wind_speed ?? 0;
  
  let score = 0;
  
  // Temperature scoring (0-40 points)
  if (temp >= 22 && temp <= 28) score += 40; // Perfect
  else if (temp >= 18 && temp < 22) score += 30; // Good
  else if (temp > 28 && temp <= 32) score += 25; // Hot but okay
  else if (temp >= 15 && temp < 18) score += 20; // Cool but acceptable
  
  // Precipitation scoring (0-30 points)
  if (precip < 10) score += 30; // Minimal rain
  else if (precip < 30) score += 20; // Light chance
  else if (precip < 50) score += 10; // Moderate chance
  
  // Wind scoring (0-20 points)
  if (wind < 15) score += 20; // Calm
  else if (wind < 25) score += 10; // Breezy
  
  // Condition bonus (0-10 points)
  const condition = day.condition?.toLowerCase() ?? '';
  if (condition.includes('clear') || condition.includes('sunny')) score += 10;
  else if (condition.includes('partly')) score += 5;
  
  return score; // Max 100
}

/**
 * Find nearest available day to target date
 */
function findNearestAvailableDay(targetDate: string, availableDays: string[]): string {
  if (availableDays.includes(targetDate)) {
    return targetDate;
  }
  
  const target = new Date(targetDate).getTime();
  let nearest = availableDays[0];
  let minDiff = Math.abs(new Date(availableDays[0]).getTime() - target);
  
  for (const day of availableDays) {
    const diff = Math.abs(new Date(day).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = day;
    }
  }
  
  return nearest;
}

/**
 * Get Danish day name from day of week number
 */
function getDayName(dayOfWeek: number): string {
  const names = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
  return names[dayOfWeek] || 'Ukendt dag';
}
