/**
 * Find last working day (Mon-Fri) of a given month
 */
import { WEATHER_THRESHOLDS } from '../_shared/post-helpers/strategy/weather-thresholds.ts';

export function getLastWorkingDayOfMonth(year, month) {
  // month is 0-based (0=Jan, 11=Dec)
  const lastDay = new Date(year, month + 1, 0); // Last day of month
  let date = lastDay.getDate();
  let day = lastDay.getDay(); // 0=Sun, 6=Sat
  // If Saturday, go back to Friday
  if (day === 6) date -= 1;
  else if (day === 0) date -= 2;
  return new Date(year, month, date);
}
/**
 * Calculate economic timing from date (Step 2)
 * CONSERVATIVE: Only elevate payday when the last working day of month
 * actually falls within this week. No narrative strings — AI draws its own conclusions.
 */ export function calculateEconomicTiming(weekStartDate) {
  const dayOfMonth = weekStartDate.getDate();
  const month = weekStartDate.getMonth(); // 0-based
  const monthNum = month + 1; // 1-12
  const year = weekStartDate.getFullYear();
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  // Calculate week end (Sunday)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  // Find last working day of current month
  const lastWorkingDay = getLastWorkingDayOfMonth(year, month);
  // Payday = last working day of month falls strictly within this Mon–Sun window
  const paydayInWeek = lastWorkingDay >= weekStartDate && lastWorkingDay <= weekEndDate;
  const WEEKDAY_NAMES = [
    'søndag',
    'mandag',
    'tirsdag',
    'onsdag',
    'torsdag',
    'fredag',
    'lørdag'
  ];
  const payday_day_name = paydayInWeek ? WEEKDAY_NAMES[lastWorkingDay.getDay()] : undefined;
  let pattern;
  // Special months
  if (monthNum === 12) {
    pattern = 'december_high';
  } else if (monthNum === 7) {
    pattern = 'july_vacation';
  } else if (paydayInWeek) {
    // Actual payday week — signal is real
    pattern = 'salary_week';
  } else if (weekOfMonth <= 3) {
    // Weeks 1-3: normal mid-month spend
    pattern = 'normal_spend';
  } else {
    // Week 4+: end of month, no payday confirmed
    pattern = 'budget_conscious';
  }
  return {
    week_of_month: weekOfMonth,
    pattern,
    is_july: monthNum === 7,
    payday_this_week: paydayInWeek,
    payday_day_name
  };
}
export function economicRelevanceForArchetype(archetype) {
  if ([
    'wine_bar',
    'late_night_bar',
    'dinner_restaurant',
    'full_service_restaurant',
    'evening_bar'
  ].includes(archetype)) {
    return 'high'; // Evening/premium — payday unlocks real spending uplift
  }
  if ([
    'fast_casual',
    'lunch_restaurant',
    'brunch_cafe',
    'all_day_cafe'
  ].includes(archetype)) {
    return 'medium'; // Daytime — payday has some impact but not the primary occasion driver
  }
  // morning_cafe: coffee is a daily habit independent of pay cycle
  return 'low';
}
/**
 * Derive the compact operating-model classification for a business.
 * More precise than BusinessArchetype — considers takeaway model and service format.
 */ export function deriveBusinessMode(ctx) {
  const periods = ctx.service_periods ?? [];
  const hasBreakfast = periods.includes('breakfast') || periods.includes('morning');
  const hasBrunch = periods.includes('brunch');
  const hasLunch = periods.includes('lunch');
  const hasDinner = periods.includes('dinner');
  const hasBar = periods.includes('bar') || periods.includes('drinks');
  const isLateNight = ctx.late_night_closing === true;
  const hasTakeaway = ctx.location.has_takeaway === true;
  const hasTableService = ctx.location.has_table_service !== false; // default true
  // Coffee bar: morning-only + takeaway-led, minimal seated service
  if (hasBreakfast && hasTakeaway && !hasTableService && !hasLunch && !hasDinner) {
    return 'coffee_bar_takeaway';
  }
  // Morning only (table service)
  if (hasBreakfast && !hasBrunch && !hasLunch && !hasDinner) {
    return 'morning_cafe';
  }
  // Brunch + lunch, no dinner
  if ((hasBrunch || hasBreakfast) && hasLunch && !hasDinner && !hasBar && !isLateNight) {
    return 'brunch_lunch_cafe';
  }
  // Brunch only (no lunch, no dinner)
  if (hasBrunch && !hasLunch && !hasDinner) {
    return 'all_day_cafe';
  }
  // Lunch only
  if (hasLunch && !hasBrunch && !hasBreakfast && !hasDinner) {
    return 'lunch_restaurant';
  }
  // Evening/bar only (no daytime food)
  if ((hasDinner || hasBar || isLateNight) && !hasLunch && !hasBrunch && !hasBreakfast) {
    if (isLateNight || hasBar && !hasDinner) return 'evening_bar';
    return 'dinner_restaurant';
  }
  // Spans day + evening
  if ((hasBrunch || hasBreakfast || hasLunch) && (hasDinner || hasBar || isLateNight)) {
    return 'hybrid_day_to_evening';
  }
  // Lunch + evening bar (no morning)
  if (hasLunch && (hasBar || isLateNight) && !hasDinner) {
    return 'hybrid_day_to_evening';
  }
  // QSR / Food truck — treat as lunch_restaurant
  if (ctx.business_type === 'QSR' || ctx.business_type === 'FOOD_TRUCK') {
    return 'lunch_restaurant';
  }
  // Fallback
  return 'all_day_cafe';
}
/**
 * Derive weather relevance fields specific to this business type and week.
 * Produces three complementary fields that replace the coarse weather_is_differentiator boolean.
 * Now uses unified thresholds from WEATHER_THRESHOLDS configuration.
 */ export function deriveWeatherRelevance(ctx, businessMode) {
  const avgTemp = ctx.weather.avg_temp;
  const hasTerrace = ctx.location.has_outdoor_seating;
  const hasTakeaway = ctx.location.has_takeaway === true;
  const days = ctx.weather.days;
  
  // Calculate average feels-like temperature (uses apparent_temperature if available)
  const avgFeelsLike = days.length > 0 
    ? days.reduce((s, d) => s + (d.feels_like ?? d.temp_max), 0) / days.length 
    : avgTemp;
  
  const avgRain = days.length > 0 ? days.reduce((s, d)=>s + (d.precipitation_chance ?? 0), 0) / days.length : 0;
  const avgWind = days.length > 0 ? days.reduce((s, d)=>s + (d.wind_speed ?? 0), 0) / days.length : 0;
  
  // visit_behavior - uses unified WEATHER_THRESHOLDS
  let weather_effect_on_visit_behavior;
  if (hasTerrace 
      && avgFeelsLike >= WEATHER_THRESHOLDS.TERRACE_PULL.feelsLikeTempMin 
      && avgRain < WEATHER_THRESHOLDS.TERRACE_PULL.rainProbMax 
      && avgWind < WEATHER_THRESHOLDS.TERRACE_PULL.windSpeedMax) {
    weather_effect_on_visit_behavior = 'terrace_pull';
  } else if (hasTakeaway && [
    'coffee_bar_takeaway',
    'morning_cafe'
  ].includes(businessMode) && (avgTemp < WEATHER_THRESHOLDS.TAKEAWAY_PULL.tempMax || avgRain > WEATHER_THRESHOLDS.TAKEAWAY_PULL.rainProbMin)) {
    weather_effect_on_visit_behavior = 'takeaway_pull';
  } else if ([
    'dinner_restaurant',
    'evening_bar'
  ].includes(businessMode) && !hasTerrace) {
    // Advance-booking model — weather at decision time is irrelevant
    weather_effect_on_visit_behavior = 'minimal';
  } else if (avgFeelsLike <= WEATHER_THRESHOLDS.INDOOR_REFUGE.feelsLikeTempMax || avgRain >= WEATHER_THRESHOLDS.INDOOR_REFUGE.rainProbMin) {
    weather_effect_on_visit_behavior = 'indoor_refuge';
  } else {
    weather_effect_on_visit_behavior = 'minimal';
  }
  
  // relevance
  let weather_relevance_for_business;
  if (hasTerrace || [
    'coffee_bar_takeaway',
    'morning_cafe'
  ].includes(businessMode)) {
    weather_relevance_for_business = 'high';
  } else if ([
    'dinner_restaurant',
    'evening_bar'
  ].includes(businessMode) && !hasTerrace) {
    weather_relevance_for_business = 'low';
  } else {
    weather_relevance_for_business = 'medium';
  }
  
  // daypart effect
  const periods = ctx.service_periods ?? [];
  const hasBreakfast = periods.includes('breakfast') || periods.includes('morning') || periods.includes('brunch');
  const hasLunch = periods.includes('lunch');
  const hasDinner = periods.includes('dinner');
  let weather_effect_on_daypart;
  if (weather_effect_on_visit_behavior === 'minimal') {
    weather_effect_on_daypart = 'minimal';
  } else if (weather_effect_on_visit_behavior === 'takeaway_pull') {
    weather_effect_on_daypart = 'morning';
  } else if (weather_effect_on_visit_behavior === 'terrace_pull') {
    if ([
      'all_day_cafe',
      'hybrid_day_to_evening',
      'brunch_lunch_cafe'
    ].includes(businessMode)) {
      weather_effect_on_daypart = 'all_day';
    } else if (hasLunch && !hasDinner) {
      weather_effect_on_daypart = 'lunch';
    } else if (hasDinner && !hasLunch) {
      weather_effect_on_daypart = 'evening';
    } else {
      weather_effect_on_daypart = 'lunch'; // lunch typically warmest outdoor window
    }
  } else {
    // indoor_refuge — affect peak daypart
    if (hasBreakfast && hasLunch && hasDinner) {
      weather_effect_on_daypart = 'all_day';
    } else if (hasLunch) {
      weather_effect_on_daypart = 'lunch';
    } else if (hasDinner) {
      weather_effect_on_daypart = 'evening';
    } else {
      weather_effect_on_daypart = 'morning';
    }
  }
  return {
    weather_relevance_for_business,
    weather_effect_on_daypart,
    weather_effect_on_visit_behavior
  };
}
/**
 * Split seasonal context into two tiers:
 *  seasonal_mood_signals       — abstract behavioural descriptors for this season; NO ingredient names.
 *                                Safe to pass to any AI phase for atmosphere/framing.
 *  menu_supported_seasonal_signals — ingredient names confirmed present on this business's menu.
 *                                Only these may appear in narrative output.
 */ export function deriveSeasonalSignals(ctx, ingredientsInSeason) {
  // Abstract season context — behavioural, not ingredient-based.
  // Giving the AI ingredient names here (even labelled "atmosphere only") causes
  // hallucinated food references. Use season_name + behavioral descriptors only.
  // Get current month for granular summer signals (tourist timing)
  const weekStartDate = new Date(ctx.week_start);
  const monthIndex = weekStartDate.getMonth(); // 0 = Jan, 5 = Jun, 6 = Jul, etc.
  const SEASON_CONTEXT = {
    spring: [
      'stigende dagslys og udeaktivitet',
      'mildere temperaturer øger spontane besøg',
      'forårsenergi forstærker destinationsbesøg'
    ],
    summer: monthIndex >= 6 && monthIndex <= 7 // July (6) and August (7) only
     ? [
      'højsæson og turistflow',
      'lune aftener forstærker terrassebesøg',
      'feriemodus og spontane besøg dominerer'
    ] : [
      'stigende udendørs aktivitet hos lokale',
      'lune aftener forstærker terrassebesøg',
      'spontane besøg stiger blandt lokale'
    ],
    autumn: [
      'faldende temperatur øger indendørsbesøg',
      'comfort food-efterspørgsel stiger',
      'kortere dagslys reducerer spontane aftensbesøg'
    ],
    winter: [
      'koldt vejr driver kaffepause-besøg indendørs',
      'indendørs opholdskvalitet er det primære besøgsargument',
      'december øger sociale sammenkomster og planlagte besøg'
    ]
  };
  const seasonal_mood_signals = SEASON_CONTEXT[ctx.season.current] ?? [];
  // Build a single lowercase string from all menu text for matching
  const menuText = [
    ...ctx.menu_summaries?.map((m)=>m.summary) ?? [],
    ...ctx.signature_items.map((i)=>[
        i.name,
        i.description ?? ''
      ].join(' '))
  ].join(' ').toLowerCase();
  const menu_supported_seasonal_signals = ingredientsInSeason.filter((ingredient)=>menuText.includes(ingredient.toLowerCase()));
  return {
    seasonal_mood_signals,
    menu_supported_seasonal_signals
  };
}
/**
 * Derive visit-mode classification and primary visit motivation.
 * Prevents generic "cozy place in bad weather" framing by giving Phase 1
 * a concrete behavioural anchor.
 */ export function deriveVisitMode(ctx, businessMode) {
  // visit_mode from businessMode + location context
  let visit_mode;
  if ([
    'dinner_restaurant',
    'evening_bar'
  ].includes(businessMode) || ctx.location.tourist_context) {
    visit_mode = 'destination';
  } else if ([
    'morning_cafe',
    'coffee_bar_takeaway'
  ].includes(businessMode)) {
    visit_mode = 'convenience';
  } else {
    visit_mode = 'mixed';
  }
  // primary_visit_motivation from matched_motivations
  const motivations = ctx.location.matched_motivations ?? [];
  const MOTIVATION_GROUP_MAP = [
    {
      keys: [
        'socialt_samvær',
        'social',
        'group',
        'gathering'
      ],
      motivation: 'social'
    },
    {
      keys: [
        'forkælelse',
        'treat',
        'special',
        'forkæle'
      ],
      motivation: 'treat'
    },
    {
      keys: [
        'turist_oplevelse',
        'destinationsbesøg',
        'discovery',
        'tourist',
        'explore'
      ],
      motivation: 'discovery'
    },
    {
      keys: [
        'arbejdsfrokost',
        'frokostnødvendighed',
        'pause',
        'work',
        'break',
        'ritual'
      ],
      motivation: 'pause'
    },
    {
      keys: [
        'dinner',
        'dining',
        'meal'
      ],
      motivation: 'meal'
    }
  ];
  let primary_visit_motivation = 'meal';
  outer: for (const group of MOTIVATION_GROUP_MAP){
    for (const mot of motivations){
      if (group.keys.some((k)=>mot === k || mot.toLowerCase().includes(k))) {
        primary_visit_motivation = group.motivation;
        break outer;
      }
    }
  }
  // Fallback from businessMode when no motivations
  if (motivations.length === 0) {
    if ([
      'morning_cafe',
      'coffee_bar_takeaway'
    ].includes(businessMode)) primary_visit_motivation = 'pause';
    else if ([
      'dinner_restaurant',
      'evening_bar'
    ].includes(businessMode)) primary_visit_motivation = 'social';
    else primary_visit_motivation = 'meal';
  }
  // Secondary: motivations that map to a different group than primary
  const resolveGroup = (mot)=>{
    for (const group of MOTIVATION_GROUP_MAP){
      if (group.keys.some((k)=>mot === k || mot.toLowerCase().includes(k))) return group.motivation;
    }
    return 'other';
  };
  const secondary_visit_motivations = motivations.filter((m)=>{
    const resolved = resolveGroup(m);
    return resolved !== primary_visit_motivation;
  });
  return {
    visit_mode,
    primary_visit_motivation,
    secondary_visit_motivations
  };
}
/**
 * Calculate which service period is commercially most important this specific week.
 * Scoring-based: starts from service periods, applies modifiers for weather, economics,
 * events, visit mode, and historical patterns.
 */ export function deriveDaypartPriority(ctx, businessMode, visitMode, weatherEffectOnDaypart) {
  const periods = ctx.service_periods ?? [];
  const hasBreakfast = periods.includes('breakfast') || periods.includes('morning') || periods.includes('brunch');
  const hasLunch = periods.includes('lunch');
  const hasDinner = periods.includes('dinner');
  const hasBar = periods.includes('bar') || periods.includes('drinks');
  // Seed scores for each available daypart
  const scores = {};
  if (hasBreakfast) scores['morning'] = 1.0;
  if (hasLunch) scores['lunch'] = 1.0;
  if (hasDinner || hasBar) scores['evening'] = 1.0;
  if (ctx.late_night_closing) scores['late_night'] = 0.7;
  // Fallback from businessMode if service_periods is empty
  if (Object.keys(scores).length === 0) {
    if ([
      'morning_cafe',
      'coffee_bar_takeaway'
    ].includes(businessMode)) scores['morning'] = 1.0;
    else if ([
      'dinner_restaurant',
      'evening_bar'
    ].includes(businessMode)) scores['evening'] = 1.0;
    else if (businessMode === 'lunch_restaurant') scores['lunch'] = 1.0;
    else {
      scores['lunch'] = 1.0;
      scores['evening'] = 1.0;
    }
  }
  // Weather modifier
  if (weatherEffectOnDaypart !== 'minimal') {
    if (weatherEffectOnDaypart === 'all_day') {
      for (const k of Object.keys(scores))scores[k] += 0.2;
    } else if (scores[weatherEffectOnDaypart] !== undefined) {
      scores[weatherEffectOnDaypart] += 0.4;
    }
  }
  // Economic modifier
  if (ctx.economic.pattern === 'salary_week') {
    if ([
      'dinner_restaurant',
      'evening_bar'
    ].includes(businessMode) && scores['evening'] !== undefined) {
      scores['evening'] += 0.3;
    }
    if ([
      'morning_cafe',
      'coffee_bar_takeaway'
    ].includes(businessMode) && scores['morning'] !== undefined) {
      scores['morning'] += 0.2;
    }
  }
  // Event modifier
  const closestEvent = ctx.events.length > 0 ? ctx.events.reduce((a, b)=>a.days_away <= b.days_away ? a : b) : null;
  if (closestEvent && closestEvent.days_away <= 10) {
    const eventDay = new Date(closestEvent.date).getDay();
    const isWeekendEvent = eventDay === 0 || eventDay === 6;
    if (isWeekendEvent && visitMode === 'destination' && scores['evening'] !== undefined) {
      scores['evening'] += 0.3;
    } else if (!isWeekendEvent && scores['lunch'] !== undefined) {
      scores['lunch'] += 0.2;
    }
  }
  // Visit mode modifier
  if (visitMode === 'destination' && scores['evening'] !== undefined) scores['evening'] += 0.2;
  if (visitMode === 'convenience' && scores['morning'] !== undefined) scores['morning'] += 0.2;
  // Historical selection patterns
  const sp = ctx.previous_week?.selection_patterns;
  if ((sp?.weeks_analyzed ?? 0) >= 3) {
    const rates = sp.goal_mode_rates;
    if ((rates['drive_footfall'] ?? 0) >= 0.5) {
      const trafficDaypart = [
        'dinner_restaurant',
        'evening_bar'
      ].includes(businessMode) ? 'evening' : 'lunch';
      if (scores[trafficDaypart] !== undefined) scores[trafficDaypart] += 0.15;
    }
  }
  // Resolve
  const sorted = Object.entries(scores).sort((a, b)=>b[1] - a[1]);
  const primary_daypart_this_week = sorted[0]?.[0] ?? 'lunch';
  const secondary_daypart_this_week = sorted[1]?.[0] ?? 'evening';
  // Template-based Danish reasoning string
  const labelMap = {
    morning: 'morgen',
    lunch: 'frokost',
    afternoon: 'eftermiddag',
    early_evening: 'tidlig aften',
    evening: 'aften',
    late_night: 'sen aften'
  };
  const reasons = [];
  if (weatherEffectOnDaypart !== 'minimal') {
    const wEffect = ctx.weather_effect_on_visit_behavior;
    const wNote = {
      terrace_pull: `terrasse-vejr (${ctx.weather.avg_temp}°C)`,
      indoor_refuge: `indendørs bias (${ctx.weather.avg_temp}°C)`,
      takeaway_pull: `afhentningsvejr (${ctx.weather.avg_temp}°C)`
    };
    if (wEffect && wNote[wEffect]) reasons.push(wNote[wEffect]);
  }
  if (ctx.economic.pattern === 'salary_week') reasons.push('lønningsuge');
  if (closestEvent && closestEvent.days_away <= 10) reasons.push(closestEvent.name_dk);
  const primaryLabel = labelMap[primary_daypart_this_week] ?? primary_daypart_this_week;
  const daypart_reasoning = reasons.length > 0 ? `${reasons.join(' + ')} → ${primaryLabel} er kommercielt stærkest denne uge` : `${primaryLabel} er standardprioritering for dette forretningsformat`;
  return {
    primary_daypart_this_week,
    secondary_daypart_this_week,
    daypart_reasoning
  };
}
/**
 * Build structured strategic priority candidates.
 * Template-based pool scored against this week's context.
 * Replaces flat string[] top_weekly_priorities with reasoned, machine-readable candidates.
 */ export function buildStrategicPriorityCandidates(ctx, businessMode, visitMode, primaryDaypart, weatherRelevance, weatherVisitBehavior, economicRelevance, menuSupportedSeasonalSignals) {
  const candidates = [];
  const avgTemp = ctx.weather.avg_temp;
  const periods = ctx.service_periods ?? [];
  const hasLunch = periods.includes('lunch');
  const hasDinner = periods.includes('dinner');
  const hasBrunch = periods.includes('brunch') || periods.includes('breakfast') || periods.includes('morning');
  const closestEvent = ctx.events.length > 0 ? ctx.events.reduce((a, b)=>a.days_away <= b.days_away ? a : b) : null;
  const sp = ctx.previous_week?.selection_patterns;
  // 1. Indoor comfort / refuge
  if (weatherVisitBehavior === 'indoor_refuge') {
    const reason = `${avgTemp}°C med ${ctx.weather.pattern.replace('_', ' ')} øger søgningen efter indendørs pausesteder`;
    candidates.push({
      label: 'Indendørs tilstrømning — dårligt vejr øger planlagte indebesøg',
      customer_behavior_reason: reason,
      business_reason: `${businessMode.replace(/_/g, ' ')} med indendørs servering matcher den øgede søgning efter planlagte indebesøg i dårligt vejr`,
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: [
        'comforting_mains',
        'warm_dishes',
        'seasonal_menu'
      ],
      weather_relevance: 'high',
      location_relevance: weatherRelevance === 'high' ? 'high' : 'medium',
      confidence: 0.75
    });
  }
  // 2. Terrace / outdoor season
  if (weatherVisitBehavior === 'terrace_pull' && ctx.location.has_outdoor_seating) {
    candidates.push({
      label: 'Terrasse — walk-in trafik og udendørs besøg i godt vejr',
      customer_behavior_reason: `${avgTemp}°C og sol øger spontane udendørsbeslutninger og walk-in besøg`,
      business_reason: 'Udendørs servering er en direkte konkurrencefordel i godt vejr',
      daypart_relevance: [
        primaryDaypart,
        'all_day'
      ],
      menu_relevance: [
        'drinks',
        'light_bites',
        'seasonal_menu'
      ],
      weather_relevance: 'high',
      location_relevance: ctx.location.tourist_context ? 'high' : 'medium',
      confidence: 0.87
    });
  }
  // 3. Takeaway pull
  if (weatherVisitBehavior === 'takeaway_pull') {
    candidates.push({
      label: 'Afhentning og morgenmobilitet',
      customer_behavior_reason: 'Koldt/vådt vejr øger villigheden til hurtig afhentning frem for siddested',
      business_reason: 'Takeaway-format er konkurrencedygtigt i dårligt vejr',
      daypart_relevance: [
        'morning',
        'lunch'
      ],
      menu_relevance: [
        'coffee',
        'takeaway_items',
        'morning_menu'
      ],
      weather_relevance: 'high',
      location_relevance: 'medium',
      confidence: 0.70
    });
  }
  // 4. Payday treat (high relevance)
  if (ctx.economic.payday_this_week && economicRelevance === 'high') {
    const dayLabel = ctx.economic.payday_day_name ? ` (${ctx.economic.payday_day_name})` : '';
    candidates.push({
      label: `Lønningsuge${dayLabel} — forhøjet premium-adfærd`,
      customer_behavior_reason: 'Gæsterne har fået løn og vælger opad — appetite på premium retter, vin og aftenbooking stiger målbart',
      business_reason: 'Premiumtilbud og aftenbooking passer direkte til lønningsugens forbrugsadfærd',
      daypart_relevance: [
        'evening'
      ],
      menu_relevance: [
        'signature_dishes',
        'wine',
        'premium_mains'
      ],
      weather_relevance: 'low',
      location_relevance: 'low',
      confidence: 0.78
    });
  }
  // 5. Payday casual (medium relevance)
  if (ctx.economic.payday_this_week && economicRelevance === 'medium') {
    candidates.push({
      label: 'Lønningsuge — lidt mere plads i budgettet',
      customer_behavior_reason: 'Gæsterne har lidt mere at bruge af og er åbne for at vælge lidt bedre end normalt',
      business_reason: 'Dagsmenu og klassikere med god p/k-ratio er attraktive i lønningsuge',
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: [
        'lunch_classics',
        'daily_specials'
      ],
      weather_relevance: 'low',
      location_relevance: 'low',
      confidence: 0.65
    });
  }
  // 6. Weekend social destination
  const hasWeekend = ctx.available_days.some((d)=>{
    const day = new Date(d).getDay();
    return day === 0 || day === 6;
  });
  if (visitMode === 'destination' && hasWeekend) {
    candidates.push({
      label: 'Weekendudflugt som planlagt destination',
      customer_behavior_reason: 'Weekend-gæster planlægger besøget og forventer en samlet oplevelse, ikke bare mad',
      business_reason: 'Destinationskarakter og atmosfære er stærkere på en weekend end dagligt',
      daypart_relevance: hasBrunch ? [
        'morning',
        'lunch'
      ] : [
        'evening'
      ],
      menu_relevance: [
        'signature_dishes',
        'brunch_menu',
        'sharing_plates'
      ],
      weather_relevance: weatherRelevance,
      location_relevance: ctx.location.tourist_context ? 'high' : 'medium',
      confidence: 0.70
    });
  }
  // 7. Event tie-ins — one candidate per distinct public holiday in the planning window.
  // Using a 10-day horizon (not 7) to capture holidays that fall at the end of the week
  // when the plan is generated a day or two before the week starts.
  // Non-holiday occasions (school_vacation, season_change, etc.) only get a single candidate
  // when there are no public holidays, preventing them from drowning out holiday framing.
  const holidayEventsInWindow = ctx.events.filter((e)=>e.type === 'holiday' && e.days_away <= 10);
  const nonHolidayEventsInWindow = ctx.events.filter((e)=>e.type !== 'holiday' && e.days_away <= 10);
  for (const event of holidayEventsInWindow){
    const dayLabel = event.days_away === 0 ? 'i dag' : `om ${event.days_away} dage`;
    candidates.push({
      label: event.days_away === 0 ? event.name_dk : `Byg op til ${event.name_dk}`,
      customer_behavior_reason: `${event.name_dk} ${dayLabel} — ${event.strategic_angle}`,
      business_reason: 'Helligdag skaber konkret anledning og reducerer beslutningsbarrieren — helligdagsframing differentierer fra generiske hverdagsposter',
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: [
        'seasonal_menu',
        'signature_dishes'
      ],
      weather_relevance: 'low',
      location_relevance: 'medium',
      confidence: 0.85
    });
  }
  // Non-holiday occasion candidate — only when there are no public holidays in the window
  if (nonHolidayEventsInWindow.length > 0 && holidayEventsInWindow.length === 0) {
    const closest = nonHolidayEventsInWindow.reduce((a, b)=>a.days_away <= b.days_away ? a : b);
    candidates.push({
      label: `Byg op til ${closest.name_dk}`,
      customer_behavior_reason: `${closest.name_dk} om ${closest.days_away} dage — ${closest.strategic_angle}`,
      business_reason: 'Events skaber konkret anledning og reducerer brugerens beslutningsbarriere',
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: [
        'seasonal_menu',
        'signature_dishes'
      ],
      weather_relevance: 'low',
      location_relevance: 'medium',
      confidence: 0.82
    });
  }
  // 8. Seasonal menu highlight (only if menu-supported)
  if (menuSupportedSeasonalSignals.length > 0) {
    candidates.push({
      label: `Sæsonens råvarer: ${menuSupportedSeasonalSignals.slice(0, 2).join(' og ')}`,
      customer_behavior_reason: 'Sæsonbevidste gæster søger aktualitet og kvalitet når menuen matcher årstiden',
      business_reason: `Menuen indeholder allerede ${menuSupportedSeasonalSignals.slice(0, 2).join(' og ')} — ingen fake specificity`,
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: menuSupportedSeasonalSignals,
      weather_relevance: 'low',
      location_relevance: 'low',
      confidence: 0.65
    });
  }
  // 9. Morning ritual / daily habit
  if ([
    'morning_cafe',
    'coffee_bar_takeaway'
  ].includes(businessMode) && primaryDaypart === 'morning') {
    candidates.push({
      label: 'Morgenrutinen og den daglige pause',
      customer_behavior_reason: 'Morgenbesøget er en vane — content der spejler ritualet skaber genkendelse og loyalitet',
      business_reason: 'Morgenformat er stærkest på gentagelse og daglig loyalitet, ikke event-baseret besøg',
      daypart_relevance: [
        'morning'
      ],
      menu_relevance: [
        'coffee',
        'morning_menu',
        'pastries'
      ],
      weather_relevance: weatherRelevance,
      location_relevance: 'medium',
      confidence: 0.72
    });
  }
  // 10. Work lunch / pause destination
  if ((hasLunch || hasBrunch) && visitMode !== 'destination' && ctx.previous_week?.selection_patterns) {
    const pauseMotivations = [
      'arbejdsfrokost',
      'frokostnødvendighed',
      'pause'
    ];
    const hasPauseMotivation = (ctx.location.matched_motivations ?? []).some((m)=>pauseMotivations.some((p)=>m === p || m.includes(p)));
    if (hasPauseMotivation) {
      candidates.push({
        label: 'Arbejdsfrokost og hverdagspause',
        customer_behavior_reason: 'Kontorsegmentet søger hurtig, god og nem frokost tæt på arbejdspladsen',
        business_reason: 'Frokosttilbud og nem tilgængelighed matcher dette segments behov direkte',
        daypart_relevance: [
          'lunch'
        ],
        menu_relevance: [
          'lunch_classics',
          'daily_specials',
          'quick_lunch'
        ],
        weather_relevance: 'low',
        location_relevance: 'high',
        confidence: 0.68
      });
    }
  }
  // 11. Brand story (build_brand), triggered when historically underweighted
  const buildBrandRate = sp?.goal_mode_rates?.build_brand ?? 0;
  const baselineBuildBrand = (ctx.brand_voice?.content_strategy?.goal_blend?.build_brand ?? 25) / 100;
  if ((sp?.weeks_analyzed ?? 0) >= 2 && buildBrandRate < baselineBuildBrand - 0.15) {
    candidates.push({
      label: 'Bag om stedet — hvem vi er',
      customer_behavior_reason: 'Brandstory-posts øger loyalitet og differentiering over tid — underrepræsenteret de seneste uger',
      business_reason: 'Balance i content-mix: autenticitetsposts har ikke fået plads de seneste uger',
      daypart_relevance: [
        primaryDaypart
      ],
      menu_relevance: [
        'behind_scenes',
        'team_story'
      ],
      weather_relevance: 'low',
      location_relevance: 'medium',
      confidence: 0.58
    });
  }
  // Apply confidence modifiers
  return candidates.map((c)=>{
    let conf = c.confidence;
    // Boost if location relevance aligns with tourist context
    if (c.location_relevance === 'high' && ctx.location.tourist_context) conf += 0.05;
    // Historical boost: if this goal_mode has been selected before
    if (sp?.weeks_analyzed && sp.weeks_analyzed >= 1) {
      const rates = sp.goal_mode_rates;
      if (c.daypart_relevance.includes('evening') && (rates['drive_footfall'] ?? 0) > 0.4) conf += 0.05;
    }
    // Penalise if primary daypart doesn't overlap with candidate's dayparts
    const daypartOverlap = c.daypart_relevance.some((d)=>d === primaryDaypart || d === 'all_day');
    if (!daypartOverlap) conf -= 0.15;
    return {
      ...c,
      confidence: Math.max(0, Math.min(1, conf))
    };
  }).filter((c)=>c.confidence >= 0.40).sort((a, b)=>b.confidence - a.confidence).slice(0, 6);
}
/**
 * Synthesises location behavior, visit motivation, and daypart into compact,
 * already-interpreted narrative strings for prompt injection.
 * These represent HOW this place is used — stronger framing signal than raw weather.
 */ export function deriveWeeklyFraming(locationBehaviorMode, primaryVisitMotivation, secondaryMotivations, primaryDaypart, secondaryDaypart, businessMode, economicRelevance, ctx) {
  // ─ Location framing: synthesise mode + enriching context ───────────────────
  const LOCATION_BASE = {
    waterfront_outing: 'destination ved vandet — gæster tager herhen for oplevelsen og miljøet',
    city_office_lunch: 'bycenter frokostplads — primært kontor- og pendlerflow i dagtimerne',
    city_shopping_flow: 'bycenter med spontan gennemstrømning — walk-in fra handel og byliv',
    tourist_discovery: 'turistzone — besøgende søger signaturret og lokal stedssærpræg',
    residential_habitual: 'lokalmiljø med stamgæster — hverdagsritual og gentagne besøg fra nærområdet',
    suburban_destination: 'forstadsudflugtssted — planlagt tur med klar besøgshænsigt',
    generic: 'urban lokation med blandet trafikgrundlag'
  };
  let location_framing = LOCATION_BASE[locationBehaviorMode];
  // Season enrichment for high-impact combinations
  const season = ctx.season.current;
  if (locationBehaviorMode === 'waterfront_outing') {
    if (season === 'spring') location_framing += ' — forårs-udflugtsenergi øger destinationsbesøg';
    else if (season === 'summer') location_framing += ' — sommer-højsæson for vandkants-destinations';
  }
  if (ctx.location.tourist_context && locationBehaviorMode !== 'tourist_discovery') {
    location_framing += ' (turistflow tilstede ved siden af lokale gæster)';
  }
  // ─ Motivation framing: synthesise motivation + matched motivations + contextual boosts ─
  const MOTIVATION_BASE = {
    social: 'planlagt socialt besøg — gæsterne kommer i grupper og forventer en oplevelse',
    pause: 'hverdagspause og rutinebesøg — frekvent, vanestyret trafik',
    meal: 'målrettet måltidsbesøg — gæsten har bestemt sig for at spise ude',
    treat: 'forkælelsesbesøg — gæsten vil undte sig selv og er åben for premium',
    discovery: 'opdagelsesbesøg — førstegangsgæst eller aktivt søgende ny oplevelse'
  };
  let motivation_framing = MOTIVATION_BASE[primaryVisitMotivation] ?? primaryVisitMotivation;
  const matched = ctx.location.matched_motivations ?? [];
  if (matched.some((m)=>m.includes('familie') || m.includes('family'))) {
    motivation_framing += ' (familiegruppetrafik relevant)';
  }
  if (matched.some((m)=>m.includes('arbejdsfrokost') || m.includes('frokostнødvendighed'))) {
    motivation_framing += ' — arbejdsfrokostgæster dominerer på hverdage';
  }
  if (matched.some((m)=>m.includes('turist') || m.includes('destinations'))) {
    motivation_framing += ' — turistgæster forstærker opdagelsesmotivet';
  }
  if (ctx.economic.payday_this_week && economicRelevance !== 'low') {
    const boost = economicRelevance === 'high' ? primaryVisitMotivation === 'treat' ? 'premiumvalg og aftenbooking' : 'premium- og aftenappetitten' : 'sandsynlighed for at vælge lidt opad';
    motivation_framing += ` + lønningsuge øger ${boost}`;
  }
  // ─ Daypart framing: primary + secondary + day-of-week pattern ──────────────
  const DAYPART_LABEL = {
    morning: 'morgen',
    lunch: 'frokost',
    afternoon: 'eftermiddag',
    early_evening: 'tidlig aften',
    evening: 'aften',
    late_night: 'sen aften',
    all_day: 'hele dagen'
  };
  const primaryLabel = DAYPART_LABEL[primaryDaypart] ?? primaryDaypart;
  const secondaryLabel = DAYPART_LABEL[secondaryDaypart] ?? secondaryDaypart;
  const availDays = ctx.available_days ?? [];
  const weekdayCount = availDays.filter((d)=>{
    const day = new Date(d).getDay();
    return day >= 1 && day <= 5;
  }).length;
  const weekendCount = availDays.filter((d)=>{
    const day = new Date(d).getDay();
    return day === 0 || day === 6;
  }).length;
  let daypart_framing;
  if (weekdayCount > 0 && weekendCount > 0) {
    daypart_framing = `${primaryLabel} og ${secondaryLabel} — ${weekdayCount} hverdage og ${weekendCount} weekenddage denne uge`;
  } else if (weekendCount === 0) {
    daypart_framing = `${primaryLabel} og ${secondaryLabel} — primært hverdagsbesøg`;
  } else {
    daypart_framing = `${primaryLabel} og ${secondaryLabel} — weekenddomineret uge`;
  }
  const closestEvent = ctx.events.length > 0 ? ctx.events.reduce((a, b)=>a.days_away <= b.days_away ? a : b) : null;
  if (closestEvent && closestEvent.days_away <= 5) {
    daypart_framing += ` (${closestEvent.name_dk} om ${closestEvent.days_away} dage forstærker ${primaryLabel}-trafikken)`;
  }
  return {
    location_framing,
    motivation_framing,
    daypart_framing
  };
}
/**
 * Derives a ranked hierarchy of business drivers for this specific business and week.
 * Hierarchy: 1) business identity/archetype 2) location behavior 3) guest occasions
 * 4) service period 5) contextual signals (weather/economy/events).
 * Consumed by Phase 0 prompt to prevent flat signal weighting.
 */ export function deriveBusinessDriverRanking(businessMode, locationBehaviorMode, primaryVisitMotivation, primaryDaypart, weatherRelevance, weatherVisitBehavior, economicRelevance, ctx) {
  // Tier 1 — business identity: always the primary anchor
  const businessDesc = `${businessMode.replace(/_/g, '_')}`;
  const BUSINESS_MODE_LABEL = {
    morning_cafe: 'morgen-café (daglig rutine og pause)',
    coffee_bar_takeaway: 'coffee-to-go (mobilitet og morgenritual)',
    brunch_lunch_cafe: 'brunch/frokost-café (weekend-destination og hverdagspause)',
    lunch_restaurant: 'frokostrestaurant (hverdagsfrokost og arbejdspause)',
    dinner_restaurant: 'aftenrestaurant (planlagt aftenmåltid og social udflugt)',
    evening_bar: 'aftenbar (socialt samvær og afterwork)',
    all_day_cafe: 'all-day café (fleksibelt besøg hele dagen)',
    hybrid_day_to_evening: 'dag-til-aften-format (frokost og kvældsbesøg)',
    late_night_bar: 'sen-aften-bar (natteliv og afslutning på aftenen)',
    wine_bar: 'vinbar (forkælelse og smagsnydelse)',
    fast_casual: 'fast-casual (hurtigt og uformelt)',
    full_service_restaurant: 'fuldservice-restaurant (komplet måltidsoplevelse)'
  };
  const primary_driver = BUSINESS_MODE_LABEL[businessMode] ?? businessDesc;
  // Tier 2 — location behavior: the structural guest reason to visit
  const LOCATION_LABEL = {
    waterfront_outing: 'vandkant-destination (udflugt og oplevelse)',
    city_office_lunch: 'bycenter frokostplads (kontor og pendlerflow)',
    city_shopping_flow: 'bycenter gennemstrømning (spontane besøg)',
    tourist_discovery: 'turistzone (opdagelse og særlig oplevelse)',
    residential_habitual: 'lokalmiljø (stamgæster og hverdagsritual)',
    suburban_destination: 'forstadsudflugtssted (planlagt tur)',
    generic: 'generel lokation'
  };
  const secondary_driver = LOCATION_LABEL[locationBehaviorMode] ?? locationBehaviorMode;
  // Tier 3 — supporting contextual signals (guest occasions + daypart + contextual)
  const supporting_drivers = [];
  // Guest occasion / visit motivation
  const MOTIVATION_LABEL = {
    social: `socialt samvær (${primaryDaypart})`,
    pause: `hverdagspause (${primaryDaypart})`,
    meal: `måltidsbesøg (${primaryDaypart})`,
    treat: `forkælelse (${primaryDaypart})`,
    discovery: `opdagelse og nyt sted (${primaryDaypart})`
  };
  supporting_drivers.push(MOTIVATION_LABEL[primaryVisitMotivation] ?? primaryVisitMotivation);
  // Service period
  supporting_drivers.push(`primær dagsdel: ${primaryDaypart}`);
  // Contextual: weather — only if material for this business
  if (weatherRelevance !== 'low' && weatherVisitBehavior !== 'minimal') {
    const WEATHER_LABEL = {
      terrace_pull: `terrasse-vejr (${ctx.weather.avg_temp}°C — øger walk-in)`,
      indoor_refuge: `indendørs-bias (${ctx.weather.avg_temp}°C — skubber beslutning indad)`,
      takeaway_pull: `afhentningsvejr (${ctx.weather.avg_temp}°C — øger takeaway-demand)`
    };
    const wl = WEATHER_LABEL[weatherVisitBehavior];
    if (wl) supporting_drivers.push(wl);
  }
  // Contextual: economy — only if material
  if (ctx.economic.payday_this_week && economicRelevance !== 'low') {
    const dayLabel = ctx.economic.payday_day_name ? ` (${ctx.economic.payday_day_name})` : '';
    supporting_drivers.push(`lønningsuge${dayLabel} — ${economicRelevance === 'high' ? 'stærk premiumeffekt' : 'let forbrugsstemning'}`);
  }
  // Contextual: events
  const closestEvent = ctx.events.length > 0 ? ctx.events.reduce((a, b)=>a.days_away <= b.days_away ? a : b) : null;
  if (closestEvent && closestEvent.days_away <= 10) {
    supporting_drivers.push(`${closestEvent.name_dk} om ${closestEvent.days_away} dage`);
  }
  // Tier 4 — deprioritized: signals that don't apply for this business/week
  const deprioritized_drivers = [];
  if (weatherRelevance === 'low') {
    deprioritized_drivers.push(`vejr (lav relevans for ${businessMode.replace(/_/g, ' ')})`);
  }
  if (!ctx.location.has_outdoor_seating) {
    deprioritized_drivers.push('udeservering (ikke tilgængeligt)');
  }
  if (!ctx.economic.payday_this_week || economicRelevance === 'low') {
    if (ctx.economic.payday_this_week && economicRelevance === 'low') {
      deprioritized_drivers.push(`lønningsuge (lav relevans for ${businessMode.replace(/_/g, ' ')})`);
    }
  }
  return {
    primary_driver,
    secondary_driver,
    supporting_drivers,
    deprioritized_drivers
  };
}
/**
 * Derives the behavioral location mode for this business.
 * Pure decision tree from location.type and primary daypart.
 */ export function deriveLocationBehaviorMode(ctx) {
  const locType = ctx.location?.type;
  const primaryDaypart = ctx.primary_daypart_this_week;
  if (locType === 'waterfront') return 'waterfront_outing';
  if (locType === 'tourist_area') return 'tourist_discovery';
  if (locType === 'city_center') {
    // City center with a lunch-focused daypart → office/commuter traffic
    if (primaryDaypart && primaryDaypart.toLowerCase().includes('lunch')) return 'city_office_lunch';
    return 'city_shopping_flow';
  }
  if (locType === 'residential') return 'residential_habitual';
  if (locType === 'suburban') return 'suburban_destination';
  return 'generic';
}
/**
 * Derives a structured interpretation of what matters this week for this specific business.
 * Pure TypeScript — no AI cost. Called after WeekContext is assembled but before generateWeeklyStrategy().
 * Produces the fields consumed by Phase 0 and Phase 1 prompts.
 */ export function deriveWeeklyInterpretation(ctx) {
  // ── 1. Business Archetype (legacy — kept for backwards compat) + BusinessMode ──
  const periods = ctx.service_periods ?? [];
  const hasBreakfast = periods.includes('breakfast') || periods.includes('morning');
  const hasBrunch = periods.includes('brunch');
  const hasLunch = periods.includes('lunch');
  const hasDinner = periods.includes('dinner');
  const hasBar = periods.includes('bar') || periods.includes('drinks');
  const isLateNight = ctx.late_night_closing === true;
  let business_archetype;
  if (isLateNight && hasBar) {
    business_archetype = 'late_night_bar';
  } else if (ctx.business_type === 'SBO_wine' || hasBar && !hasLunch && !hasDinner && !hasBrunch) {
    business_archetype = 'wine_bar';
  } else if (ctx.business_type === 'QSR' || ctx.business_type === 'FOOD_TRUCK') {
    business_archetype = 'fast_casual';
  } else if (hasDinner && (hasLunch || hasBrunch)) {
    business_archetype = 'full_service_restaurant';
  } else if (hasDinner && !hasLunch && !hasBrunch) {
    business_archetype = 'dinner_restaurant';
  } else if (hasLunch && !hasDinner && !hasBrunch) {
    business_archetype = 'lunch_restaurant';
  } else if (hasBrunch && hasLunch && !hasDinner) {
    business_archetype = 'all_day_cafe';
  } else if (hasBrunch && !hasLunch && !hasDinner) {
    business_archetype = 'brunch_cafe';
  } else if ((hasBreakfast || ctx.business_type === 'SBO_coffee') && !hasDinner) {
    business_archetype = 'morning_cafe';
  } else if (hasBar && hasDinner) {
    business_archetype = 'evening_bar';
  } else {
    // Fallback based on business type
    if (ctx.business_type === 'SBO_coffee') business_archetype = 'morning_cafe';
    else if (ctx.business_type === 'SBO_cocktail') business_archetype = 'evening_bar';
    else business_archetype = 'full_service_restaurant';
  }
  // ── 1b. BusinessMode (new — derived independently for precision) ──────────
  const business_mode = deriveBusinessMode(ctx);
  // ── 1c. Weather Relevance (replaces boolean weather_is_differentiator) ────
  const { weather_relevance_for_business, weather_effect_on_daypart, weather_effect_on_visit_behavior } = deriveWeatherRelevance(ctx, business_mode);
  // ── 1d. Seasonal Signals Split ────────────────────────────────────────────
  const { seasonal_mood_signals, menu_supported_seasonal_signals } = deriveSeasonalSignals(ctx, ctx.season.ingredients_in_season);
  // ── 2. Core Business Drivers ─────────────────────────────────────────────
  const core_business_drivers = [];
  const strategy = ctx.brand_voice?.content_strategy;
  if (strategy?.brand_anchors) {
    for (const anchor of strategy.brand_anchors){
      core_business_drivers.push({
        driver: anchor,
        always_relevant: true
      });
    }
  }
  if (strategy?.footfall_signals) {
    for (const signal of strategy.footfall_signals){
      core_business_drivers.push({
        driver: signal,
        always_relevant: false,
        amplified_by: [
          'weekend',
          'payday',
          'sunny'
        ]
      });
    }
  }
  // Add outdoor if applicable
  if (ctx.location.has_outdoor_seating) {
    core_business_drivers.push({
      driver: 'Udendørs oplevelse',
      always_relevant: false,
      amplified_by: [
        'sunny',
        'warm',
        'weekend'
      ]
    });
  }
  // Always have at least one generic driver if none were set
  if (core_business_drivers.length === 0) {
    core_business_drivers.push({
      driver: ctx.business_name,
      always_relevant: true
    });
  }
  // ── 3. Primary Guest Occasions ────────────────────────────────────────────
  const primary_guest_occasions = [];
  const motivations = ctx.location.matched_motivations ?? [];
  const MOTIVATION_OCCASION_MAP = {
    socialt_samvær: {
      occasion: 'Socialt samvær med venner/kolleger',
      primary: true,
      day_pattern: 'any'
    },
    frokostnødvendighed: {
      occasion: 'Hverdagsfrokost',
      primary: true,
      day_pattern: 'weekday'
    },
    destinationsbesøg: {
      occasion: 'Destination og udflugt',
      primary: true,
      day_pattern: 'weekend'
    },
    familieudflugt: {
      occasion: 'Familieudflugt',
      primary: false,
      day_pattern: 'weekend'
    },
    hygge_lokal: {
      occasion: 'Lokal hyggestemning',
      primary: true,
      day_pattern: 'any'
    },
    turist_oplevelse: {
      occasion: 'Turistoplevelse',
      primary: false,
      day_pattern: 'any'
    },
    arbejdsfrokost: {
      occasion: 'Arbejdsfrokost/-møde',
      primary: false,
      day_pattern: 'weekday'
    },
    forkælelse: {
      occasion: 'Forkælelse og særlige øjeblikke',
      primary: false,
      day_pattern: 'weekend'
    },
    discovery: {
      occasion: 'Opdagelse og nyt sted',
      primary: false,
      day_pattern: 'any'
    }
  };
  for (const mot of motivations){
    const mapped = MOTIVATION_OCCASION_MAP[mot];
    if (mapped) primary_guest_occasions.push({
      ...mapped
    });
  }
  // Add service-period based occasions if none from motivations
  if (primary_guest_occasions.length === 0) {
    if (hasBrunch || hasBreakfast) {
      primary_guest_occasions.push({
        occasion: 'Weekendbrunch',
        primary: true,
        day_pattern: 'weekend'
      });
    }
    if (hasLunch) {
      primary_guest_occasions.push({
        occasion: 'Hverdagsfrokost',
        primary: true,
        day_pattern: 'weekday'
      });
    }
    if (hasDinner) {
      primary_guest_occasions.push({
        occasion: 'Aftensmad ude',
        primary: true,
        day_pattern: 'any'
      });
    }
  }
  // ── 4. Week Modifiers ─────────────────────────────────────────────────────
  // Economic signal
  const economic_signal = ctx.economic.payday_this_week ? 'push' : ctx.economic.pattern === 'budget_conscious' ? 'none' : 'neutral';
  // Event weight — look at closest upcoming event
  const closestEvent = ctx.events.length > 0 ? ctx.events.reduce((a, b)=>a.days_away <= b.days_away ? a : b) : null;
  const event_weight = !closestEvent ? 'none' : closestEvent.days_away <= 3 ? 'high' : closestEvent.days_away <= 7 ? 'medium' : 'low';
  // Weather opportunity
  const wi = ctx.weather_interpretation;
  const weather_opportunity = !wi ? 'normal' : wi.indoor_outdoor_bias === 'strongly_outdoor' || wi.indoor_outdoor_bias === 'lean_outdoor' ? 'strong' : wi.indoor_outdoor_bias === 'strongly_indoor' ? 'constrained' : 'normal';
  // Overall priority
  const overallScore = (economic_signal === 'push' ? 2 : economic_signal === 'neutral' ? 1 : 0) + (event_weight === 'high' ? 2 : event_weight === 'medium' ? 1 : 0) + (weather_opportunity === 'strong' ? 1 : weather_opportunity === 'constrained' ? -1 : 0);
  const overall_priority = overallScore >= 3 ? 'high' : overallScore <= 0 ? 'low' : 'normal';
  const week_modifiers = {
    economic_signal,
    event_weight,
    weather_opportunity,
    overall_priority
  };
  // ── 6. Narrative Guardrails ───────────────────────────────────────────────
  // Compile a hard language blocklist from brand voice settings.
  // Each entry is a concrete instruction the AI must follow in Phase 1.
  const narrative_guardrails = [];
  const bv = ctx.brand_voice;
  if (bv?.never_say && Array.isArray(bv.never_say)) {
    for (const word of bv.never_say){
      if (word && typeof word === 'string' && word.trim()) {
        narrative_guardrails.push(`Skriv ALDRIG: "${word.trim()}"`);
      }
    }
  }
  if (bv?.voice_constraints && typeof bv.voice_constraints === 'string' && bv.voice_constraints.trim()) {
    narrative_guardrails.push(`Skriveprincip: ${bv.voice_constraints.trim()}`);
  }
  // Weather-derived: if weather is strongly indoor, avoid outdoor framing
  if (ctx.weather_interpretation?.indoor_outdoor_bias === 'strongly_indoor') {
    narrative_guardrails.push('Undgå at omtale udendørs oplevelse eller terrasse som et plus denne uge — vejret understøtter det ikke');
  }
  // ── 7. Weather Is Differentiator (backwards compat — derived from new fields) ─
  const weather_is_differentiator = weather_relevance_for_business !== 'low';
  // ── 8. Economic Relevance ─────────────────────────────────────────────────
  // Archetype-based ceiling, collapsed to 'low' when no payday this week so all
  // downstream gates can rely on a single field instead of the (archetype + payday_this_week) pair.
  const archetype_economic_relevance = economicRelevanceForArchetype(business_archetype);
  const economic_relevance_for_business = ctx.economic.payday_this_week ? archetype_economic_relevance : 'low';
  // ── 9. Visit Mode ─────────────────────────────────────────────────────────
  const { visit_mode, primary_visit_motivation, secondary_visit_motivations } = deriveVisitMode(ctx, business_mode);
  // ── 10. Daypart Priority ─────────────────────────────────────────────────
  const { primary_daypart_this_week, secondary_daypart_this_week, daypart_reasoning } = deriveDaypartPriority(ctx, business_mode, visit_mode, weather_effect_on_daypart);
  // ── 11. Location Behavior Mode ────────────────────────────────────────────────
  // Needs primary_daypart_this_week already computed (step 10)
  const location_behavior_mode = deriveLocationBehaviorMode({
    ...ctx,
    primary_daypart_this_week
  });
  // ── 12. Structured Strategic Candidates ─────────────────────────────────────
  const strategic_priority_candidates_v2 = buildStrategicPriorityCandidates(ctx, business_mode, visit_mode, primary_daypart_this_week, weather_relevance_for_business, weather_effect_on_visit_behavior, economic_relevance_for_business, menu_supported_seasonal_signals);
  // ── 13. Business Driver Ranking ───────────────────────────────────────────
  const business_driver_ranking = deriveBusinessDriverRanking(business_mode, location_behavior_mode, primary_visit_motivation, primary_daypart_this_week, weather_relevance_for_business, weather_effect_on_visit_behavior, economic_relevance_for_business, ctx);
  // ── 14. Weekly Framing (synthesised, human-readable signals) ────────────────────
  const weekly_framing = deriveWeeklyFraming(location_behavior_mode, primary_visit_motivation, secondary_visit_motivations, primary_daypart_this_week, secondary_daypart_this_week, business_mode, economic_relevance_for_business, ctx);
  return {
    business_archetype,
    business_mode,
    core_business_drivers,
    primary_guest_occasions,
    week_modifiers,
    top_weekly_priorities: strategic_priority_candidates_v2.slice(0, 5).map((c)=>c.label),
    narrative_guardrails,
    weather_is_differentiator,
    economic_relevance_for_business,
    weather_relevance_for_business,
    weather_effect_on_daypart,
    weather_effect_on_visit_behavior,
    visit_mode,
    primary_visit_motivation,
    secondary_visit_motivations,
    primary_daypart_this_week,
    secondary_daypart_this_week,
    daypart_reasoning,
    seasonal_mood_signals,
    menu_supported_seasonal_signals,
    strategic_priority_candidates_v2,
    location_behavior_mode,
    business_driver_ranking,
    weekly_framing
  };
}
// Get real season context based on Danish seasonal patterns
export function getRealSeasonContext(weekStart, country) {
  const month = new Date(weekStart).getMonth() + 1;
  const DK_SEASONS = {
    12: {
      current: 'winter',
      ingredients_in_season: [
        'kål',
        'rodfrugter',
        'æbler',
        'pærer',
        'vildand'
      ],
      out_of_season: [
        'jordbær',
        'tomater',
        'asparges'
      ]
    },
    1: {
      current: 'winter',
      ingredients_in_season: [
        'kål',
        'rodfrugter',
        'selleri',
        'porrer'
      ],
      out_of_season: [
        'jordbær',
        'tomater',
        'agurk'
      ]
    },
    2: {
      current: 'winter',
      ingredients_in_season: [
        'kål',
        'rodfrugter',
        'pærer',
        'citrusfrugter'
      ],
      out_of_season: [
        'jordbær',
        'hindbær',
        'tomater'
      ]
    },
    3: {
      current: 'spring',
      ingredients_in_season: [
        'forårsløg',
        'spinat',
        'radiser',
        'ramsløg'
      ],
      out_of_season: [
        'rodfrugter',
        'kål'
      ]
    },
    4: {
      current: 'spring',
      ingredients_in_season: [
        'asparges',
        'ramsløg',
        'spinat',
        'ærter'
      ],
      out_of_season: []
    },
    5: {
      current: 'spring',
      ingredients_in_season: [
        'asparges',
        'jordbær',
        'ærter',
        'nye kartofler'
      ],
      out_of_season: []
    },
    6: {
      current: 'summer',
      ingredients_in_season: [
        'jordbær',
        'hindbær',
        'tomater',
        'nye kartofler',
        'agurk'
      ],
      out_of_season: [
        'kål',
        'rodfrugter'
      ]
    },
    7: {
      current: 'summer',
      ingredients_in_season: [
        'hindbær',
        'blåbær',
        'tomater',
        'zucchini',
        'majs'
      ],
      out_of_season: []
    },
    8: {
      current: 'summer',
      ingredients_in_season: [
        'blommetomater',
        'majs',
        'figner',
        'svampe'
      ],
      out_of_season: []
    },
    9: {
      current: 'autumn',
      ingredients_in_season: [
        'svampe',
        'æbler',
        'pærer',
        'blommer',
        'græskar'
      ],
      out_of_season: [
        'tomater',
        'agurk'
      ]
    },
    10: {
      current: 'autumn',
      ingredients_in_season: [
        'græskar',
        'svampe',
        'æbler',
        'vildand',
        'kål'
      ],
      out_of_season: []
    },
    11: {
      current: 'autumn',
      ingredients_in_season: [
        'kål',
        'rodfrugter',
        'vildand',
        'vildsvin',
        'æbler'
      ],
      out_of_season: [
        'jordbær',
        'tomater'
      ]
    }
  };
  return DK_SEASONS[month] || {
    current: 'spring',
    ingredients_in_season: [],
    out_of_season: []
  };
}
