/**
 * Event Classifier - Event Type Taxonomy
 * 
 * Purpose: Classify events by decision timing to determine posting strategy
 * 
 * Event Types:
 * - advance_booking: Reservations made 3-7 days ahead (Valentines, Mors Dag)
 * - same_day: Decisions made morning-of or day-before (Grundlovsdag, Easter Monday)
 * - multi_day: Extended periods requiring span coverage (Easter weekend, Christmas week)
 * - reactive: Weather or spontaneous opportunities (First warm day, rainy weekend)
 * - season_start: School vacations, seasonal shifts (Summer break begins)
 */

export type EventType = 
  | 'advance_booking'   // Book 3-7 days ahead
  | 'same_day'          // Decide morning-of or day-before
  | 'multi_day'         // Span across period
  | 'reactive'          // Weather, spontaneous
  | 'season_start';     // School vacation, seasonal

export interface EventClassification {
  event_name: string;
  event_date: string;
  event_type: EventType;
  posting_strategy: {
    lead_posts: number;          // How many days before event
    day_of_post: boolean;        // Post on actual event day?
    day_after_post: boolean;     // Post day after?
    recommended_post_days: string[];  // Relative days: ['-2', '-1', '0', '+1']
    recommended_times: string[];      // Post times: ['09:00', '14:00']
  };
  reasoning: string;
}

interface Event {
  name: string;
  date: string;           // YYYY-MM-DD
  category?: string;
  is_commercial?: boolean;
}

/**
 * Classify event by type and determine posting strategy
 */
export function classifyEvent(event: Event): EventClassification {
  const eventNameLower = event.name.toLowerCase();
  
  // ========================================================================
  // ADVANCE BOOKING HOLIDAYS (Reservations 3-7 days ahead)
  // ========================================================================
  
  if (
    eventNameLower.includes('valentine') ||
    eventNameLower.includes('mors dag') ||
    eventNameLower.includes('fars dag') ||
    eventNameLower.includes('nytår') ||
    eventNameLower.includes('new year')
  ) {
    return {
      event_name: event.name,
      event_date: event.date,
      event_type: 'advance_booking',
      posting_strategy: {
        lead_posts: 3,
        day_of_post: false,
        day_after_post: false,
        recommended_post_days: ['-5', '-3', '-1'],  // 5, 3, 1 days before
        recommended_times: ['14:00', '14:00', '14:00'],
      },
      reasoning: `${event.name} requires advance reservations - post during booking window (3-7 days before) to capture planning phase. No need for day-of post.`
    };
  }
  
  // ========================================================================
  // SAME-DAY HOLIDAYS (Decide morning-of or day-before)
  // ========================================================================
  
  if (
    eventNameLower.includes('grundlovsdag') ||
    eventNameLower.includes('store bededag') ||
    eventNameLower.includes('kristi himmelfartsdag') ||
    eventNameLower.includes('1. maj') ||
    eventNameLower.includes('may day')
  ) {
    return {
      event_name: event.name,
      event_date: event.date,
      event_type: 'same_day',
      posting_strategy: {
        lead_posts: 1,
        day_of_post: true,
        day_after_post: false,
        recommended_post_days: ['-1', '0'],  // Day before + day of
        recommended_times: ['14:00', '09:00'],
      },
      reasoning: `${event.name} is a same-day decision holiday - post day-before to build awareness and day-of to catch morning planners. Critical to have presence ON the day itself.`
    };
  }
  
  // ========================================================================
  // MULTI-DAY PERIODS (Span across extended period)
  // ========================================================================
  
  if (
    eventNameLower.includes('påske') ||
    eventNameLower.includes('easter') ||
    eventNameLower.includes('pinse') ||
    eventNameLower.includes('whitsun') ||
    eventNameLower.includes('jul') ||
    eventNameLower.includes('christmas')
  ) {
    return {
      event_name: event.name,
      event_date: event.date,
      event_type: 'multi_day',
      posting_strategy: {
        lead_posts: 2,
        day_of_post: true,
        day_after_post: true,
        recommended_post_days: ['-2', '0', '+2'],  // Before, during, after
        recommended_times: ['14:00', '09:00', '10:00'],
      },
      reasoning: `${event.name} is a multi-day period - post before (build anticipation), during (capture visitors), and after (extend engagement). Span the entire period.`
    };
  }
  
  // ========================================================================
  // SEASON START (School vacation, seasonal shifts)
  // ========================================================================
  
  if (
    eventNameLower.includes('sommerferie') ||
    eventNameLower.includes('summer break') ||
    eventNameLower.includes('efterårsferie') ||
    eventNameLower.includes('vinterferie') ||
    eventNameLower.includes('school vacation')
  ) {
    return {
      event_name: event.name,
      event_date: event.date,
      event_type: 'season_start',
      posting_strategy: {
        lead_posts: 1,
        day_of_post: true,
        day_after_post: false,
        recommended_post_days: ['-1', '0'],  // Day before + first day
        recommended_times: ['14:00', '10:00'],
      },
      reasoning: `${event.name} marks a seasonal shift - post day-before to announce and first day to welcome the new period. Captures mindset change.`
    };
  }
  
  // ========================================================================
  // REACTIVE EVENTS (Weather, spontaneous)
  // ========================================================================
  
  if (
    eventNameLower.includes('first warm day') ||
    eventNameLower.includes('sunny weekend') ||
    eventNameLower.includes('rainy') ||
    event.category === 'weather'
  ) {
    return {
      event_name: event.name,
      event_date: event.date,
      event_type: 'reactive',
      posting_strategy: {
        lead_posts: 0,
        day_of_post: true,
        day_after_post: false,
        recommended_post_days: ['0'],  // Day-of only
        recommended_times: ['09:00'],
      },
      reasoning: `${event.name} is reactive/weather-driven - post same-day to capture spontaneous decisions. No advance planning possible.`
    };
  }
  
  // ========================================================================
  // DEFAULT: Same-day holiday strategy
  // ========================================================================
  
  return {
    event_name: event.name,
    event_date: event.date,
    event_type: 'same_day',
    posting_strategy: {
      lead_posts: 1,
      day_of_post: true,
      day_after_post: false,
      recommended_post_days: ['-1', '0'],
      recommended_times: ['14:00', '09:00'],
    },
    reasoning: `Unknown event type - defaulting to same-day strategy (day-before + day-of) as safest coverage pattern.`
  };
}

/**
 * Convert relative day offsets to absolute dates
 * 
 * Example:
 *   event_date: '2026-06-05' (Friday)
 *   recommended_post_days: ['-1', '0']
 *   → ['2026-06-04', '2026-06-05'] (Thursday, Friday)
 */
export function resolvePostingDates(
  eventDate: string,
  relativeDays: string[]
): string[] {
  const eventDateObj = new Date(eventDate);
  
  return relativeDays.map(relativeDay => {
    const offset = parseInt(relativeDay, 10);
    const postDate = new Date(eventDateObj);
    postDate.setDate(postDate.getDate() + offset);
    
    return postDate.toISOString().split('T')[0];  // YYYY-MM-DD
  });
}

/**
 * Get day of week for a date
 */
export function getDayOfWeek(date: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateObj = new Date(date);
  return days[dateObj.getDay()];
}

/**
 * Check if event falls within a week
 */
export function isEventInWeek(
  eventDate: string,
  weekStartDate: string
): boolean {
  const event = new Date(eventDate);
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);  // 7-day week
  
  return event >= weekStart && event <= weekEnd;
}

/**
 * Example usage and tests
 */
export function testEventClassifier() {
  const testEvents: Event[] = [
    { name: 'Valentines Day', date: '2026-02-14' },
    { name: 'Grundlovsdag', date: '2026-06-05' },
    { name: 'Easter Monday', date: '2026-04-06' },
    { name: 'Sommerferie starter', date: '2026-06-26' },
    { name: 'First warm day', date: '2026-05-10', category: 'weather' }
  ];
  
  console.log('=== Event Classifier Tests ===\n');
  
  for (const event of testEvents) {
    const classification = classifyEvent(event);
    const postingDates = resolvePostingDates(
      event.date,
      classification.posting_strategy.recommended_post_days
    );
    
    console.log(`Event: ${event.name}`);
    console.log(`  Type: ${classification.event_type}`);
    console.log(`  Strategy: ${classification.reasoning}`);
    console.log(`  Posting dates: ${postingDates.map(d => `${getDayOfWeek(d)} ${d}`).join(', ')}`);
    console.log(`  Times: ${classification.posting_strategy.recommended_times.join(', ')}`);
    console.log('');
  }
}

/**
 * Expected test output:
 * 
 * Event: Valentines Day
 *   Type: advance_booking
 *   Strategy: Valentines Day requires advance reservations...
 *   Posting dates: Tuesday 2026-02-09, Thursday 2026-02-11, Friday 2026-02-13
 *   Times: 14:00, 14:00, 14:00
 * 
 * Event: Grundlovsdag
 *   Type: same_day
 *   Strategy: Grundlovsdag is a same-day decision holiday...
 *   Posting dates: Thursday 2026-06-04, Friday 2026-06-05
 *   Times: 14:00, 09:00
 * 
 * Event: Easter Monday
 *   Type: multi_day
 *   Strategy: Easter Monday is a multi-day period...
 *   Posting dates: Saturday 2026-04-04, Monday 2026-04-06, Wednesday 2026-04-08
 *   Times: 14:00, 09:00, 10:00
 */
