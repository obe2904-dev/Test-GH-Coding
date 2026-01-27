import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { LOCATION_EXPECTATIONS, getLocationExpectations } from '../_shared/location-expectations.ts';
import type { ConceptFitInput, ConceptFitOutput } from '../_shared/concept-fit-types.ts';
import { getLocationGuidance } from '../_shared/brand-profile/prompts/prompt-builder.ts';
import { callGeminiJSON } from '../_shared/gemini-client.ts';

(async () => {
  const serve = (typeof Deno !== 'undefined')
    ? (await import('https://deno.land/std@0.168.0/http/server.ts')).serve
    : (handler: (req: any) => Promise<Response>) => {
      // In Node test environment we expect a global test hook to run the handler.
      // Tests can set `globalThis.__TEST_RUNNER_SERVE__ = (h) => h` to execute the handler.
      if ((globalThis as any).__TEST_RUNNER_SERVE__) {
        return (globalThis as any).__TEST_RUNNER_SERVE__(handler);
      }
      // Otherwise, provide a no-op to avoid runtime remote imports during tests.
      return undefined as unknown as ReturnType<typeof handler>;
    };

  serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get request body
    const body = await req.json();
    const businessId = body.business_id || body.businessId;

    if (!businessId) {
      throw new Error('business_id or businessId is required');
    }

    console.log(`[Concept Fit] Starting analysis for business: ${businessId}`);

    // =====================================================
    // STEP 1: Fetch Location Intelligence (from Step 1)
    // =====================================================
    const { data: locationData, error: locationError } = await supabaseClient
      .from('business_location_intelligence')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (locationError || !locationData) {
      throw new Error(`Location intelligence not found for business ${businessId}. Run Step 1 first.`);
    }

    const primaryLocationType = locationData.area_type;
    const categoryScores = locationData.category_scores || {};
    const primaryScore = categoryScores[primaryLocationType] || 0;

    console.log(`[Concept Fit] Primary location type: ${primaryLocationType} (${primaryScore}%)`);

    // =====================================================
    // STEP 2: Load Location Expectations
    // =====================================================
    const locationExpectations = getLocationExpectations(primaryLocationType);

    if (!locationExpectations) {
      throw new Error(`No expectations defined for location type: ${primaryLocationType}`);
    }

    console.log(`[Concept Fit] Loaded expectations for ${locationExpectations.displayName}`);

    // =====================================================
    // STEP 3: Fetch Business Data
    // =====================================================
    
    // 3A: Business Operations
    const { data: operations } = await supabaseClient
      .from('business_operations')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // 3B: Business Profile
    const { data: profile } = await supabaseClient
      .from('business_profile')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // 3C: Brand Profile
    const { data: brandProfile } = await supabaseClient
      .from('business_brand_profile')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // 3D: Menu Data (REAL menu from website)
    const { data: menuResults, error: menuError } = await supabaseClient
      .from('menu_results_v2')
      .select('structured_data')
      .eq('business_id', businessId)
      .eq('status', 'done');

    if (menuError) {
      console.warn('[Concept Fit] Menu data not found:', menuError.message);
    }

    // Extract menu summary
    let menuSummary = null;
    if (menuResults && menuResults.length > 0) {
      menuSummary = extractMenuSummary(menuResults);
      console.log('[Concept Fit] Menu summary extracted:', menuSummary);
    }

    console.log(`[Concept Fit] Fetched business data from 3 tables + menu data`);

    // =====================================================
    // STEP 4: Analyze Concept Fit
    // =====================================================
    const conceptFit = await analyzeConceptFit({
      businessId,
      locationTypeId: primaryLocationType,
      locationScore: primaryScore,
      locationExpectations,
      businessData: {
        operations,
        profile,
        brandProfile,
        menuSummary,
      },
    });

    console.log(`[Concept Fit] Analysis complete: ${conceptFit.overall_fit_level} fit`);

    // =====================================================
    // STEP 5: Save Results to Database
    // =====================================================
    const { error: insertError } = await supabaseClient
      .from('business_concept_fit')
      .upsert({
        business_id: businessId,
        analyzed_for_location_type: primaryLocationType,
        
        // Overall fit
        overall_fit_level: conceptFit.overall_fit_level,
        overall_fit_score: conceptFit.overall_fit_score,
        overall_fit_confidence: conceptFit.overall_fit_confidence,
        
        // Factor fits
        customer_fit: conceptFit.customer_fit,
        motivation_fit: conceptFit.motivation_fit,
        pace_fit: conceptFit.pace_fit,
        price_fit: conceptFit.price_fit,
        winning_angles_fit: conceptFit.winning_angles_fit,
        
        // Analysis details
        fit_reasons: conceptFit.fit_reasons,
        mismatch_reasons: conceptFit.mismatch_reasons,
        strengths: conceptFit.strengths,
        weaknesses: conceptFit.weaknesses,
        
        // Strategy
        strategy_approach: conceptFit.strategy_approach,
        strategy_positioning: conceptFit.strategy_positioning,
        emphasis: conceptFit.emphasis,
        avoid: conceptFit.avoid,
        cta_style: conceptFit.cta_style,
        
        // Detected motivations
        detected_motivations: conceptFit.detected_motivations,
        
        // External factors (from location expectations)
        weather_sensitivity: locationExpectations.weather_sensitivity,
        seasonality_pattern: locationExpectations.seasonality.pattern,
        seasonal_weights: locationExpectations.seasonality.seasonal_weights,
        
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[Concept Fit] Database insert error:', insertError);
      throw insertError;
    }

    console.log(`[Concept Fit] Results saved to database`);

    // =====================================================
    // STEP 6: Return Results
    // =====================================================
    return new Response(
      JSON.stringify({
        success: true,
        businessId,
        conceptFit,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[Concept Fit] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// =====================================================
// EXTRACT BALANCED MENU SUMMARY FROM STRUCTURED DATA
// =====================================================

function extractMenuSummary(menuResults: any[]): string {
  const brunchItems: string[] = [];
  const lunchItems: string[] = [];
  const dinnerItems: string[] = [];
  const allCategories: Set<string> = new Set();
  
  for (const result of menuResults) {
    const data = result.structured_data;
    if (!data || !data.categories) continue;
    
    const menuTitle = data.menuTitle?.toUpperCase() || '';
    const isBrunch = menuTitle.includes('BRUNCH');
    const isDinner = menuTitle.includes('AFTEN');
    const isLunch = menuTitle.includes('FROKOST');
    
    // Process each category
    for (const category of data.categories) {
      if (category.name) {
        allCategories.add(category.name);
      }
      
      if (!category.items || category.items.length === 0) continue;
      
      // Extract items based on meal period
      const items = category.items
        .filter((item: any) => item.name && item.name.length < 60) // Reasonable length
        .map((item: any) => item.name);
      
      if (isBrunch) {
        brunchItems.push(...items.slice(0, 2)); // Max 2 per category
      } else if (isDinner) {
        dinnerItems.push(...items.slice(0, 2));
      } else if (isLunch) {
        lunchItems.push(...items.slice(0, 2));
      }
    }
  }
  
  // Build balanced summary with representation from all meal periods
  const selectedBrunch = [...new Set(brunchItems)].slice(0, 4); // 4 brunch items
  const selectedLunch = [...new Set(lunchItems)].slice(0, 4);   // 4 lunch items
  const selectedDinner = [...new Set(dinnerItems)].slice(0, 4); // 4 dinner items
  
  const menuParts: string[] = [];
  
  if (selectedBrunch.length > 0) {
    menuParts.push(`Brunch: ${selectedBrunch.join(', ')}`);
  }
  
  if (selectedLunch.length > 0) {
    menuParts.push(`Frokost: ${selectedLunch.join(', ')}`);
  }
  
  if (selectedDinner.length > 0) {
    menuParts.push(`Aften: ${selectedDinner.join(', ')}`);
  }
  
  const categoryList = [...allCategories].slice(0, 10).join(', ');
  
  return `
MENU KATEGORIER: ${categoryList}

MENU HIGHLIGHTS:
${menuParts.join('\n')}

VIGTIGT: Spred anbefalinger på tværs af brunch, frokost og aften. Nævn IKKE kun brunch-items.
`.trim();
}

// =====================================================
// CORE ANALYSIS FUNCTION
// =====================================================

interface AnalysisInput {
  businessId: string;
  locationTypeId: string;
  locationScore: number;
  locationExpectations: any;
  businessData: {
    operations: any;
    profile: any;
    brandProfile: any;
    menuSummary: string | null;
  };
}

async function analyzeConceptFit(input: AnalysisInput): Promise<ConceptFitOutput> {
  const { locationExpectations, businessData } = input;

  // =====================================================
  // Factor 1: Customer Match
  // =====================================================
  const customerFit = evaluateCustomerFit(
    locationExpectations.typical_customers,
    businessData
  );

  // =====================================================
  // Factor 2: Motivation Match (AI-powered)
  // =====================================================
  const { motivationFit, detectedMotivations } = await evaluateMotivationFit(
    locationExpectations.typical_motivations,
    businessData
  );

  // =====================================================
  // Factor 3: Pace Match
  // =====================================================
  const paceFit = evaluatePaceFit(
    locationExpectations.pace,
    businessData.operations
  );

  // =====================================================
  // Factor 4: Price Match
  // =====================================================
  const priceFit = evaluatePriceFit(
    locationExpectations.price_sensitivity,
    businessData.operations?.price_level
  );

  // =====================================================
  // Factor 5: Winning Angles Match
  // =====================================================
  const winningAnglesFit = evaluateWinningAnglesFit(
    locationExpectations.winning_angles,
    businessData
  );

  // =====================================================
  // Calculate Overall Fit
  // =====================================================
  const factorScores = {
    customer: customerFit.score,
    motivation: motivationFit.score,
    pace: paceFit.score,
    price: priceFit.score,
    winning_angles: winningAnglesFit.score,
  };

  const overallScore = Object.values(factorScores).reduce((a, b) => a + b, 0) / 5;

  let overallFitLevel: 'strong' | 'moderate' | 'challenging';
  if (overallScore >= 0.7) overallFitLevel = 'strong';
  else if (overallScore >= 0.4) overallFitLevel = 'moderate';
  else overallFitLevel = 'challenging';

  // =====================================================
  // Determine Strategy Approach
  // =====================================================
  let strategyApproach: 'amplify' | 'adapt' | 'contrarian';
  if (overallFitLevel === 'strong') strategyApproach = 'amplify';
  else if (overallFitLevel === 'moderate') strategyApproach = 'adapt';
  else strategyApproach = 'contrarian';

  // =====================================================
  // Generate Strategy Guidance (AI-powered)
  // =====================================================
  const strategy = await generateStrategy({
    fitLevel: overallFitLevel,
    approach: strategyApproach,
    locationExpectations,
    businessData,
    factorResults: {
      customerFit,
      motivationFit,
      paceFit,
      priceFit,
      winningAnglesFit,
    },
  });

  // =====================================================
  // Compile Results
  // =====================================================
  return {
    businessId: input.businessId,
    locationTypeId: input.locationTypeId,
    
    overall_fit_level: overallFitLevel,
    overall_fit_score: overallScore,
    overall_fit_confidence: 0.85, // TODO: Calculate based on data completeness
    
    customer_fit: customerFit.level,
    motivation_fit: motivationFit.level,
    pace_fit: paceFit.level,
    price_fit: priceFit.level,
    winning_angles_fit: winningAnglesFit.level,
    
    fit_reasons: [
      ...customerFit.reasons,
      ...motivationFit.reasons,
      ...paceFit.reasons,
      ...priceFit.reasons,
      ...winningAnglesFit.reasons,
    ].filter(r => r.match === true).map(r => r.text),
    
    mismatch_reasons: [
      ...customerFit.reasons,
      ...motivationFit.reasons,
      ...paceFit.reasons,
      ...priceFit.reasons,
      ...winningAnglesFit.reasons,
    ].filter(r => r.match === false).map(r => r.text),
    
    strengths: strategy.strengths,
    weaknesses: strategy.weaknesses,
    
    strategy_approach: strategyApproach,
    strategy_positioning: strategy.positioning,
    emphasis: strategy.emphasis,
    avoid: strategy.avoid,
    cta_style: strategy.cta_style,
    
    detected_motivations: detectedMotivations,
    
    weather_sensitivity: locationExpectations.weather_sensitivity,
    seasonality_pattern: locationExpectations.seasonality.pattern,
    seasonal_weights: locationExpectations.seasonality.seasonal_weights,
  };
}

// =====================================================
// EVALUATION FUNCTIONS (Rule-based)
// =====================================================

function evaluateCustomerFit(expectedCustomers: string[], businessData: any) {
  const ops = businessData.operations || {};
  const menu = businessData.menuMetadata || {};
  const priceLevel = ops.price_level;
  
  const reasons = [];
  let matchCount = 0;
  let totalChecks = 0;
  
  // ===== FAMILIES WITH KIDS =====
  if (expectedCustomers.includes('families with kids')) {
    totalChecks++;
    if (menu.has_kids_menu) {
      reasons.push({ match: true, text: 'Børnemenu tilgængelig (perfekt til familier)' });
      matchCount++;
    } else if (ops.has_outdoor_seating) {
      reasons.push({ match: true, text: 'Udeservering (godt til familier med børn)' });
      matchCount += 0.5;
    } else {
      reasons.push({ match: false, text: 'Mangler børnemenu og udeservering' });
    }
  }
  
  // ===== REMOTE WORKERS =====
  if (expectedCustomers.includes('remote workers')) {
    totalChecks++;
    const hasWifi = ops.has_wifi;
    const hasOutlets = ops.has_power_outlets;
    if (hasWifi && hasOutlets) {
      reasons.push({ match: true, text: 'WiFi og stikkontakter (ideelt til fjernarbejde)' });
      matchCount++;
    } else if (hasWifi) {
      reasons.push({ match: true, text: 'WiFi tilgængelig (passer til fjernarbejdere)' });
      matchCount += 0.7;
    } else {
      reasons.push({ match: false, text: 'Mangler WiFi (udfordring for fjernarbejdere)' });
    }
  }
  
  // ===== TOURISTS =====
  if (expectedCustomers.includes('tourists')) {
    totalChecks++;
    if (priceLevel === 'Premium' || priceLevel === 'Fine Dining') {
      reasons.push({ match: true, text: 'Premium prisniveau (tiltrækker turister)' });
      matchCount++;
    } else if (ops.reservation_required) {
      reasons.push({ match: true, text: 'Reservation påkrævet (destination-karakter)' });
      matchCount += 0.6;
    }
  }
  
  // ===== STUDENTS =====
  if (expectedCustomers.includes('students')) {
    totalChecks++;
    const hasWifi = ops.has_wifi;
    const hasOutlets = ops.has_power_outlets;
    const affordable = priceLevel === 'Budget' || priceLevel === 'Affordable';
    if (hasWifi && hasOutlets && affordable) {
      reasons.push({ match: true, text: 'WiFi, stikkontakter og overkommelige priser (perfekt til studerende)' });
      matchCount++;
    } else if (hasWifi && hasOutlets) {
      reasons.push({ match: true, text: 'WiFi og stikkontakter (studie-venligt)' });
      matchCount += 0.7;
    } else if (affordable) {
      reasons.push({ match: true, text: 'Overkommelige priser (passer til studiebudget)' });
      matchCount += 0.5;
    } else {
      reasons.push({ match: false, text: 'Mangler studie-faciliteter og prisvenligt niveau' });
    }
  }
  
  // ===== WALKERS / RUNNERS / DOG OWNERS =====
  if (expectedCustomers.includes('walkers/runners/dog owners')) {
    totalChecks++;
    if (ops.has_outdoor_seating && ops.has_takeaway) {
      reasons.push({ match: true, text: 'Udeservering og takeaway (perfekt til gåture)' });
      matchCount++;
    } else if (ops.has_outdoor_seating) {
      reasons.push({ match: true, text: 'Udeservering (godt til pausestop)' });
      matchCount += 0.7;
    } else if (ops.has_takeaway) {
      reasons.push({ match: true, text: 'Takeaway tilgængelig (go-on-the-go)' });
      matchCount += 0.5;
    }
  }
  
  // ===== COUPLES =====
  if (expectedCustomers.includes('couples')) {
    totalChecks++;
    if (ops.reservation_required && ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening og reservation (date-venligt)' });
      matchCount++;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening (romantisk stemning)' });
      matchCount += 0.7;
    }
  }
  
  // ===== OFFICE WORKERS =====
  if (expectedCustomers.includes('office workers')) {
    totalChecks++;
    if (ops.has_takeaway && ops.has_table_service) {
      reasons.push({ match: true, text: 'Både takeaway og bordbetjening (fleksibelt til kontor-frokost)' });
      matchCount++;
    } else if (ops.has_takeaway) {
      reasons.push({ match: true, text: 'Takeaway (hurtig frokost-løsning)' });
      matchCount += 0.7;
    }
  }
  
  // ===== COMMUTERS =====
  if (expectedCustomers.includes('commuters')) {
    totalChecks++;
    if (ops.has_takeaway) {
      reasons.push({ match: true, text: 'Takeaway (perfekt til pendlere)' });
      matchCount++;
    } else {
      reasons.push({ match: false, text: 'Mangler takeaway (udfordring for pendlere)' });
    }
  }
  
  // ===== SHOPPERS ON BREAK =====
  if (expectedCustomers.includes('shoppers on break')) {
    totalChecks++;
    if (ops.has_takeaway && ops.has_table_service) {
      reasons.push({ match: true, text: 'Fleksibel servering (passer til shopping-pause)' });
      matchCount++;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening (god pause-mulighed)' });
      matchCount += 0.6;
    }
  }
  
  // ===== PLANNED VISITORS / DESTINATION =====
  if (expectedCustomers.includes('planned visitors')) {
    totalChecks++;
    if (ops.reservation_required && ops.has_parking) {
      reasons.push({ match: true, text: 'Reservation og parkering (perfekt til planlagte besøg)' });
      matchCount++;
    } else if (ops.reservation_required) {
      reasons.push({ match: true, text: 'Reservation påkrævet (destination-karakter)' });
      matchCount += 0.7;
    } else if (ops.has_parking) {
      reasons.push({ match: true, text: 'Parkering tilgængelig (let at besøge)' });
      matchCount += 0.5;
    }
  }
  
  // ===== CELEBRATION GROUPS =====
  if (expectedCustomers.includes('celebration groups')) {
    totalChecks++;
    if (ops.reservation_required && ops.has_table_service) {
      reasons.push({ match: true, text: 'Reservation og bordbetjening (perfekt til fejringer)' });
      matchCount++;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening (godt til grupper)' });
      matchCount += 0.6;
    }
  }
  
  // ===== CYCLISTS =====
  if (expectedCustomers.includes('cyclists')) {
    totalChecks++;
    if (ops.has_outdoor_seating && ops.has_takeaway) {
      reasons.push({ match: true, text: 'Udeservering og takeaway (cykelvenligt)' });
      matchCount++;
    } else if (ops.has_outdoor_seating) {
      reasons.push({ match: true, text: 'Udeservering (godt pausested)' });
      matchCount += 0.6;
    }
  }
  
  // ===== PARENTS WITH BABIES/STROLLERS =====
  if (expectedCustomers.includes('parents with babies/strollers')) {
    totalChecks++;
    if (ops.has_outdoor_seating) {
      reasons.push({ match: true, text: 'Udeservering (nemt med barnevogn)' });
      matchCount += 0.7;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening (serviceniveau passer)' });
      matchCount += 0.5;
    }
  }
  
  // ===== YOUNG PROFESSIONALS =====
  if (expectedCustomers.includes('young professionals')) {
    totalChecks++;
    if (ops.has_wifi && (priceLevel === 'Moderate' || priceLevel === 'Premium')) {
      reasons.push({ match: true, text: 'WiFi og moderne prisniveau (tiltrækker unge professionelle)' });
      matchCount++;
    } else if (ops.has_wifi) {
      reasons.push({ match: true, text: 'WiFi tilgængelig (moderne faciliteter)' });
      matchCount += 0.6;
    }
  }
  
  // ===== STUDY GROUPS =====
  if (expectedCustomers.includes('study groups')) {
    totalChecks++;
    if (ops.has_wifi && ops.has_power_outlets && ops.has_table_service) {
      reasons.push({ match: true, text: 'WiFi, stikkontakter og gruppeborde (perfekt til studiegrupper)' });
      matchCount++;
    } else if (ops.has_wifi && ops.has_power_outlets) {
      reasons.push({ match: true, text: 'WiFi og stikkontakter (godt til læsning)' });
      matchCount += 0.7;
    }
  }
  
  // ===== BUSINESS MEETINGS =====
  if (expectedCustomers.includes('business meetings')) {
    totalChecks++;
    if (ops.has_wifi && ops.has_table_service) {
      reasons.push({ match: true, text: 'WiFi og bordbetjening (velegnet til møder)' });
      matchCount++;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordbetjening (professionel setting)' });
      matchCount += 0.6;
    }
  }
  
  // ===== TRAVELERS / TOURISTS IN TRANSIT =====
  if (expectedCustomers.includes('travelers') || expectedCustomers.includes('tourists in transit')) {
    totalChecks++;
    if (ops.has_takeaway) {
      reasons.push({ match: true, text: 'Takeaway (perfekt til rejsende)' });
      matchCount++;
    } else {
      reasons.push({ match: false, text: 'Mangler takeaway (udfordring for rejsende)' });
    }
  }
  
  // ===== FRIENDS / SOCIAL GROUPS =====
  if (expectedCustomers.includes('friends / social groups')) {
    totalChecks++;
    const hasVariety = ops.has_takeaway || ops.has_outdoor_seating;
    const affordableForGroups = (priceLevel === 'moderate' || priceLevel === 'budget');
    
    if (ops.has_table_service && affordableForGroups && hasVariety) {
      reasons.push({ match: true, text: 'Bordservice + moderate priser + variation passer til vennegrupper' });
      matchCount++;
    } else if (ops.has_table_service && affordableForGroups) {
      reasons.push({ match: true, text: 'Bordservice + moderate priser passer til vennegrupper' });
      matchCount += 0.8;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordservice acceptabelt for vennegrupper' });
      matchCount += 0.6;
    } else {
      reasons.push({ match: false, text: 'Mangler bordservice til sociale grupper' });
      matchCount += 0.2;
    }
  }
  
  // ===== COUPLE GROUPS / DOUBLE DATES =====
  if (expectedCustomers.includes('couple groups / double dates')) {
    totalChecks++;
    const hasGroupCapacity = !ops.seating_capacity_indoor || ops.seating_capacity_indoor >= 20;
    const appropriatePricing = (priceLevel === 'moderate' || priceLevel === 'premium');
    
    if (ops.has_table_service && appropriatePricing && hasGroupCapacity) {
      reasons.push({ match: true, text: 'Bordservice + passende prisniveau + plads til grupper perfekt til par-grupper' });
      matchCount++;
    } else if (ops.has_table_service && appropriatePricing) {
      reasons.push({ match: true, text: 'Bordservice + passende prisniveau passer til par-grupper' });
      matchCount += 0.8;
    } else if (ops.has_table_service) {
      reasons.push({ match: true, text: 'Bordservice acceptabelt for par-grupper' });
      matchCount += 0.6;
    } else {
      matchCount += 0.3;
    }
  }
  
  // Calculate score
  const score = totalChecks > 0 ? matchCount / totalChecks : 0;
  
  let level: 'good' | 'moderate' | 'poor';
  if (score >= 0.7) level = 'good';
  else if (score >= 0.4) level = 'moderate';
  else level = 'poor';
  
  return { level, score, reasons };
}

function evaluatePaceFit(expectedPace: string, operations: any) {
  const hasTakeaway = operations?.has_takeaway;
  const hasTableService = operations?.has_table_service;
  const hasDelivery = operations?.has_delivery;
  const establishmentType = operations?.establishment_type?.toLowerCase() || '';
  
  let actualPace: string;
  
  // Cafes, bistros, wine bars are inherently slow/medium pace regardless of takeaway
  const isSlowEstablishment = establishmentType.includes('cafe') || 
                              establishmentType.includes('kafé') ||
                              establishmentType.includes('bistro') ||
                              establishmentType.includes('vinbar') ||
                              establishmentType.includes('wine bar') ||
                              establishmentType.includes('fine dining');
  
  // Fast food, takeaway-first places
  const isFastEstablishment = establishmentType.includes('fast food') ||
                             establishmentType.includes('quick service') ||
                             establishmentType.includes('food truck');
  
  if (isFastEstablishment) {
    actualPace = 'very_fast';
  } else if (isSlowEstablishment) {
    // Cafes/bistros are slow/medium even with takeaway
    actualPace = hasTableService ? 'slow' : 'medium';
  } else if (hasTakeaway && !hasTableService) {
    actualPace = 'very_fast';
  } else if (hasTakeaway && hasTableService) {
    actualPace = 'medium'; // Changed from 'fast' - having both doesn't mean fast
  } else if (hasTableService && !hasTakeaway) {
    actualPace = 'slow';
  } else {
    actualPace = 'medium';
  }
  
  const match = actualPace === expectedPace;
  const reasons = [];
  
  if (match) {
    reasons.push({
      match: true,
      text: `Serveringsmodel (${actualPace}) matcher området (${expectedPace})`
    });
  } else {
    reasons.push({
      match: false,
      text: `Serveringsmodel (${actualPace}) matcher ikke området (${expectedPace})`
    });
  }
  
  const score = match ? 1.0 : 0.3;
  const level = score >= 0.7 ? 'good' : score >= 0.4 ? 'moderate' : 'poor';
  
  return { level, score, reasons };
}

function evaluatePriceFit(expectedSensitivity: string, actualPriceLevel: string) {
  const priceLevelMap: Record<string, number> = {
    'Budget': 1,
    'Mid-range': 2,
    'Premium': 3,
    'Fine Dining': 4,
  };
  
  const sensitivityMap: Record<string, number> = {
    'high': 1,    // Expects budget
    'medium': 2,  // Expects mid-range
    'low': 3,     // Accepts premium
  };
  
  const actualLevel = priceLevelMap[actualPriceLevel] || 2;
  const expectedLevel = sensitivityMap[expectedSensitivity] || 2;
  
  const difference = Math.abs(actualLevel - expectedLevel);
  
  const reasons = [];
  let level: 'good' | 'moderate' | 'poor';
  let score: number;
  
  if (difference === 0) {
    level = 'good';
    score = 1.0;
    reasons.push({ match: true, text: 'Prisniveau matcher områdets forventninger perfekt' });
  } else if (difference === 1) {
    level = 'moderate';
    score = 0.6;
    reasons.push({ match: true, text: 'Prisniveau tæt på områdets forventninger' });
  } else {
    level = 'poor';
    score = 0.3;
    reasons.push({
      match: false,
      text: `${actualPriceLevel} i ${expectedSensitivity} prisfølsomt område er udfordrende`
    });
  }
  
  return { level, score, reasons };
}

function evaluateWinningAnglesFit(expectedAngles: string[], businessData: any) {
  // Simplified - check if business has features matching expected angles
  const reasons = [];
  let matchCount = 0;
  
  for (const angle of expectedAngles) {
    if (angle.toLowerCase().includes('quick') || angle.toLowerCase().includes('takeaway')) {
      if (businessData.operations?.has_takeaway) {
        reasons.push({ match: true, text: `Har takeaway (matcher "${angle}")` });
        matchCount++;
      }
    }
    
    if (angle.toLowerCase().includes('outdoor') || angle.toLowerCase().includes('terrace')) {
      if (businessData.operations?.has_outdoor_seating) {
        reasons.push({ match: true, text: `Har udeservering (matcher "${angle}")` });
        matchCount++;
      }
    }
    
    if (angle.toLowerCase().includes('quality') || angle.toLowerCase().includes('authentic')) {
      if (businessData.operations?.price_level === 'Premium') {
        reasons.push({ match: true, text: `Premium kvalitet (matcher "${angle}")` });
        matchCount++;
      }
    }
  }
  
  const score = matchCount / Math.max(expectedAngles.length, 1);
  const level = score >= 0.5 ? 'good' : score >= 0.25 ? 'moderate' : 'poor';
  
  return { level, score, reasons };
}

// =====================================================
// AI-POWERED FUNCTIONS
// =====================================================

async function evaluateMotivationFit(expectedMotivations: any[], businessData: any) {
  console.log('[Concept Fit] Detecting business motivations with Gemini...');

  const prompt = buildMotivationDetectionPrompt(expectedMotivations, businessData);
  
  interface MotivationAnalysis {
    detected_motivations: Array<{
      motivation: string;
      confidence: number;
      evidence: string;
    }>;
    overlap_with_location: {
      matching: string[];
      missing: string[];
    };
    fit_level: 'good' | 'moderate' | 'poor';
    reasoning: string;
  }

  try {
    const analysis = await callGeminiJSON<MotivationAnalysis>(prompt, {
      temperature: 0.3,
      maxTokens: 1500,
    });

    // Calculate fit score based on overlap
    const matchCount = analysis.overlap_with_location.matching.length;
    const totalExpected = expectedMotivations.length;
    const score = matchCount / Math.max(totalExpected, 1);

    // Generate reasons
    const reasons = [];
    
    for (const match of analysis.overlap_with_location.matching) {
      reasons.push({
        match: true,
        text: `Serverer "${match}" motivation (matcher området)`,
      });
    }

    for (const missing of analysis.overlap_with_location.missing.slice(0, 3)) {
      reasons.push({
        match: false,
        text: `Serverer ikke "${missing}" (typisk i området)`,
      });
    }

    return {
      motivationFit: {
        level: analysis.fit_level,
        score,
        reasons,
      },
      detectedMotivations: analysis.detected_motivations,
    };

  } catch (error) {
    console.error('[Concept Fit] Motivation detection failed:', error);
    
    // Fallback to moderate fit if AI fails
    return {
      motivationFit: {
        level: 'moderate' as const,
        score: 0.5,
        reasons: [{ match: true, text: 'Motivation analyse fejlede - bruger standard fit' }],
      },
      detectedMotivations: [],
    };
  }
}

function buildMotivationDetectionPrompt(expectedMotivations: any[], businessData: any): string {
  const { operations, profile, brandProfile, menuMetadata } = businessData;

  return `Du er ekspert i dansk restaurantbranchen og skal analysere hvilke kundemotivationer denne forretning primært serverer.

FORRETNINGSDATA:

Åbningstider:
${JSON.stringify(operations?.opening_hours || {}, null, 2)}

Prisleje: ${operations?.price_level || 'Ukendt'}
Etableringstype: ${operations?.establishment_type || 'Ukendt'}

Service:
- Bordservice: ${operations?.has_table_service ? 'Ja' : 'Nej'}
- Takeaway: ${operations?.has_takeaway ? 'Ja' : 'Nej'}
- Levering: ${operations?.has_delivery ? 'Ja' : 'Nej'}
- Udeservering: ${operations?.has_outdoor_seating ? 'Ja' : 'Nej'}

Kapacitet:
- Indendørs pladser: ${operations?.seating_capacity_indoor || 'Ukendt'}
- Udendørs pladser: ${operations?.seating_capacity_outdoor || 'Ukendt'}

Beskrivelse:
${profile?.short_description || 'Ingen beskrivelse'}

Menu karakteristika:
- Specialty kaffe: ${menuMetadata?.has_specialty_coffee ? 'Ja' : 'Nej'}
- Vin: ${menuMetadata?.has_wine_list ? 'Ja' : 'Nej'}
- Kost muligheder: ${menuMetadata?.dietary_options?.join(', ') || 'Ingen'}

Brand værdier: ${brandProfile?.values?.join(', ') || 'Ingen'}

---

OMRÅDE FORVENTNINGER:
Området forventer typisk disse kundemotivationer:
${expectedMotivations.map(m => `- ${m.motivation} (${m.prevalence} forekomst)`).join('\n')}

---

ALLE MULIGE MOTIVATIONER (vælg fra disse):
1. convenience / already here
2. routine habit (daily coffee)
3. reward / treat
4. social meet-up
5. work break
6. work/productivity (café as office)
7. business meeting
8. waiting time filler
9. date / couple time
10. family outing
11. celebration/milestone
12. destination visit (planned trip)
13. warm-up / shelter (weather-driven)
14. lunch necessity
15. support local/ethical choice
16. energy boost/caffeine need
17. pre-event/post-event
18. discovery/trying new

---

OPGAVE:
Analyser forretningsdataene og bestem:

1. Hvilke 3-5 primære kundemotivationer denne forretning FAKTISK serverer
2. Hvor stor overlap der er med områdets typiske motivationer
3. Overall motivation fit level

Returner JSON:

{
  "detected_motivations": [
    {
      "motivation": "exact motivation name from list",
      "confidence": 0.0-1.0,
      "evidence": "why you believe this (Danish, kort)"
    }
  ],
  "overlap_with_location": {
    "matching": ["motivations that match area expectations"],
    "missing": ["area expectations this business doesn't serve"]
  },
  "fit_level": "good" | "moderate" | "poor",
  "reasoning": "1-2 sentences explaining overall fit (Danish)"
}

Regler:
- Brug KUN motivation names fra listen ovenfor (exact match)
- Top 3-5 motivationer kun
- Confidence baseret på hvor klare signalerne er
- "good" fit = 60%+ overlap, "moderate" = 30-60%, "poor" = <30%
- Alt tekst på dansk undtagen motivation names (engelsk)`;
}

async function generateStrategy(input: any) {
  console.log('[Concept Fit] Generating strategy with Gemini...');

  const prompt = buildStrategyPrompt(input);

  interface StrategyOutput {
    positioning: string;
    emphasis: string[];
    avoid: string[];
    cta_style: string;
    strengths: string[];
    weaknesses: string[];
    reasoning: string;
  }

  try {
    const strategy = await callGeminiJSON<StrategyOutput>(prompt, {
      temperature: 0.4, // Slightly higher for creative strategy
      maxTokens: 2000,
    });

    return strategy;

  } catch (error) {
    console.error('[Concept Fit] Strategy generation failed:', error);

    // Fallback strategy based on approach
    const { approach } = input;

    if (approach === 'amplify') {
      return {
        positioning: 'Lean ind i områdets styrker',
        emphasis: ['Lokalitets fordele', 'Forventede services'],
        avoid: ['At gå imod områdets forventninger'],
        cta_style: 'friendly_invite',
        strengths: ['God lokationsmatch'],
        weaknesses: [],
        reasoning: 'Fallback strategi - AI analyse fejlede',
      };
    } else if (approach === 'contrarian') {
      return {
        positioning: 'Position som unik undtagelse',
        emphasis: ['Unikt tilbud', 'Værd at planlægge'],
        avoid: ['Convenience budskaber', 'Quick service'],
        cta_style: 'direct_action',
        strengths: ['Unik positionering'],
        weaknesses: ['Matcher ikke typiske forventninger'],
        reasoning: 'Fallback strategi - AI analyse fejlede',
      };
    } else {
      return {
        positioning: 'Hybrid tilgang',
        emphasis: ['Det bedste fra begge verdener'],
        avoid: ['Ekstreme påstande'],
        cta_style: 'community_style',
        strengths: ['Balanceret'],
        weaknesses: ['Kan mangle klar positionering'],
        reasoning: 'Fallback strategi - AI analyse fejlede',
      };
    }
  }
}

function buildStrategyPrompt(input: any): string {
  const {
    fitLevel,
    approach,
    locationExpectations,
    businessData,
    factorResults,
  } = input;

  const { operations, profile, brandProfile, menuSummary } = businessData;
  const locationGuidance = getLocationGuidance(locationExpectations.locationTypeId || locationExpectations.displayName, 'da-DK')

  return `Du er marketing strateg for dansk restaurantbranchen. Din opgave er at udvikle præcis, konkret strategisk vejledning.

🎯 OPGAVE:
Analyser om forretningens KONCEPT passer til LOKATIONEN og giv KONKRET strategisk vejledning.

FORRETNINGSDATA:

Navn: ${profile?.business_name || businessData.business?.name || 'Forretningen'}
Beskrivelse: ${profile?.long_description || 'Ingen beskrivelse'}

SERVICE CAPABILITIES:
- Etableringstype: ${operations?.establishment_type || 'Ukendt'}
- Prisleje: ${operations?.price_level || 'Ukendt'} (gennemsnit: ${operations?.average_check_per_person ? operations.average_check_per_person + ' ' + (operations?.currency || 'DKK') : 'Ukendt'})
- Bordservice: ${operations?.has_table_service ? 'Ja' : 'Nej'}
- Takeaway: ${operations?.has_takeaway ? 'Ja' : 'Nej'}
- Udeservering: ${operations?.has_outdoor_seating ? 'Ja' : 'Nej'}
- Børnemenu: ${operations?.has_kids_menu ? 'Ja' : 'Nej'}
- Walk-ins: ${operations?.accepts_walk_ins ? 'Ja' : operations?.reservation_required ? 'Nej (reservation påkrævet)' : 'Ukendt'}

ÅBNINGSTIDER: ${summarizeHours(operations?.opening_hours)}

${menuSummary ? `
MENU SCOPE (til kontekst - nævn IKKE specifikke retter i din strategi):
${menuSummary}
` : 'Menu data ikke tilgængelig'}

---

LOKATIONS FORVENTNINGER:
Type: ${locationExpectations.displayName}
Beskrivelse: ${locationExpectations.description}
Typiske kunder: ${locationExpectations.typical_customers.join(', ')}
Typiske motivationer: ${locationExpectations.typical_motivations.map((m: any) => m.motivation).join(', ')}
Vindende vinkler: ${locationExpectations.winning_angles.join(', ')}

LOKATIONS GUIDANCE:
${locationGuidance}

---

CONCEPT FIT ANALYSE RESULTAT:
Overall fit: ${fitLevel.toUpperCase()} (${approach.toUpperCase()} strategi)
- Kunde match: ${factorResults.customerFit.level}
- Motivation match: ${factorResults.motivationFit.level}
- Pace match: ${factorResults.paceFit.level}
- Pris match: ${factorResults.priceFit.level}

---

OUTPUT FORMAT (JSON):

{
  "positioning": "1-2 sætninger der beskriver forretningens strategiske position (Danish, max 120 tegn)",
  "emphasis": [
    "Minimum 3-4 KONKRETE strategiske fokusområder (Danish, max 70 tegn hver)",
    "Hver skal være unik, specifik og handlingsrettet",
    "Fokuser på capabilities, målgrupper, servicefordele"
  ],
  "avoid": [
    "2-3 ting at undgå strategisk (Danish, max 60 tegn hver)"
  ],
  "cta_style": "friendly_invite | direct_action | community_style | book_ahead",
  "strengths": [
    "2-3 konkrete styrker (Danish, 1 kort sætning hver)"
  ],
  "weaknesses": [
    "1-2 reelle begrænsninger eller udfordringer (Danish, 1 kort sætning hver)"
  ],
  "reasoning": "2-3 sætninger om hvorfor denne strategi passer (Danish)"
}

---

REGLER:

✅ VÆR KONKRET OG SPECIFIK:
- Nævn FAKTISKE capabilities: "all-day service 09:30-23:00", "udeservering med 30+ pladser"
- Nævn FAKTISKE målgrupper: "familier med børnemenu", "par til aftenmiddag"
- Nævn FAKTISKE tidsperioder: "weekend brunch", "sen aften fredag/lørdag"
- Nævn FAKTISKE fordele: "moderate priser (140 DKK gennemsnit)", "både casual og premium"

❌ UNDGÅ:
- Generiske vendinger: "kvalitet + service", "det bedste fra begge verdener", "balanceret tilgang"
- Vage begreber: "hybrid", "alsidighed", "variation" (uden at specificere hvad)
- Specifikke menupunkter: PARISERBØF, FAVORITTEN, RIBEYE osv.

---

GODE EKSEMPLER PÅ "emphasis":

✅ "Fremhæv all-day service fra morgenmad (09:30) til sen aften (23:00)"
✅ "Udnyt udeservering som sæsonfordel april-september"
✅ "Target familier weekend formiddag med børnemenu"
✅ "Positioner som gruppe-venligt med plads til 6-8 personer"
✅ "Spil på variation: casual frokost (120-180 DKK) til premium middag (300+ DKK)"
✅ "Brug late hours (fredag/lørdag til 02:00) til nightlife positioning"

❌ DÅRLIGE EKSEMPLER:

❌ "Kvalitet + service"
❌ "Det bedste fra begge verdener"
❌ "Hybrid tilgang"
❌ "Balanceret strategi"
❌ "Alsidighed" (uden at forklare hvad)
❌ "Prøv vores PARISERBØF" (specifik menuret)

---

KRAV:
- "emphasis" array SKAL have MINIMUM 3 items
- "strengths" array SKAL have MINIMUM 2 items
- Hver "emphasis" SKAL være unik, konkret og forskellig fra de andre
- Brug FAKTISK data fra forretningsprofilen
- Vær SPECIFIK om tal, tider, priser når tilgængelige
- "positioning" skal beskrive HVAD forretningen er, ikke bare "hybrid" eller "balanceret"

Nu: Generer strategisk analyse baseret på FAKTISKE data ovenfor.`;
}

// Helper function
function summarizeHours(hours: any): string {
  if (!hours) return 'Ukendt';
  
  const days = Object.entries(hours);
  const openDays = days.filter(([_, h]: any) => !h.closed);
  
  if (openDays.length === 0) return 'Lukket';
  if (openDays.length === 7) return 'Åben alle dage';
  
  // Check if weekend-only
  const weekendDays = openDays.filter(([day, _]) => 
    day === 'saturday' || day === 'sunday'
  );
  if (weekendDays.length === openDays.length) return 'Kun weekend';
  
  // Check if weekday-only
  const weekdayDays = openDays.filter(([day, _]) =>
    !['saturday', 'sunday'].includes(day)
  );
  if (weekdayDays.length === openDays.length) return 'Kun hverdage';
  
  // Check evening hours
  const firstOpen: any = openDays[0][1];
  if (firstOpen?.open && parseInt(firstOpen.open.split(':')[0]) >= 17) {
    return 'Primært aften';
  }
  
  return `${openDays.length} dage/uge`;
}
