import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_MODELS = {
  analysis: 'gpt-4o',              // Prompt A - stable internal analysis (temp 0.3)
  generation: 'gpt-4o'             // Prompt B - proven working model (temp 0.5)
}

// Production hardening configuration
const OPENAI_CONFIG = {
  timeout: 45000,        // 45 seconds (Edge Function limit is 150s, leave room for other steps)
  maxRetries: 3,         // Retry up to 3 times on rate limit/overload
  retryDelayMs: 1000,    // Base delay for exponential backoff
  retryStatusCodes: [429, 503, 500, 502, 504]  // Rate limit, overloaded, server errors
}

// Generate unique request ID for traceability
function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `bp-${timestamp}-${random}`
}

// Sleep helper for retry backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// OpenAI fetch with timeout and retry logic
async function fetchOpenAIWithRetry(
  url: string,
  options: RequestInit,
  requestId: string,
  context: string
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= OPENAI_CONFIG.maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_CONFIG.timeout)
    
    try {
      const startTime = Date.now()
      console.log(`[${requestId}] 🔄 ${context} attempt ${attempt}/${OPENAI_CONFIG.maxRetries}`)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const duration = Date.now() - startTime
      
      // Check for retryable status codes
      if (OPENAI_CONFIG.retryStatusCodes.includes(response.status)) {
        const retryAfter = response.headers.get('retry-after')
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : OPENAI_CONFIG.retryDelayMs * Math.pow(2, attempt - 1)
        
        console.warn(`[${requestId}] ⚠️ ${context} got ${response.status}, retrying in ${delay}ms...`)
        lastError = new Error(`OpenAI returned ${response.status}`)
        await sleep(delay)
        continue
      }
      
      console.log(`[${requestId}] ✅ ${context} completed in ${duration}ms (status: ${response.status})`)
      return response
      
    } catch (error) {
      clearTimeout(timeoutId)
      const err = error as Error
      
      if (err.name === 'AbortError') {
        console.error(`[${requestId}] ⏱️ ${context} timeout after ${OPENAI_CONFIG.timeout}ms`)
        lastError = new Error(`OpenAI request timed out after ${OPENAI_CONFIG.timeout}ms`)
      } else {
        console.error(`[${requestId}] ❌ ${context} error:`, err.message)
        lastError = err
      }
      
      if (attempt < OPENAI_CONFIG.maxRetries) {
        const delay = OPENAI_CONFIG.retryDelayMs * Math.pow(2, attempt - 1)
        console.log(`[${requestId}] 🔄 Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  
  throw lastError || new Error(`${context} failed after ${OPENAI_CONFIG.maxRetries} attempts`)
}

// ============================================================================
// LANGUAGE CONFIGURATION
// ============================================================================

interface LanguageConfig {
  code: string
  name: string
  systemPromptA: string
  instructionsPromptA: string
  countryMappings: string[]
}

const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  'da': {
    code: 'da',
    name: 'Danish',
    countryMappings: ['DK', 'Denmark'],
    systemPromptA: `Du er en brandstrateg, der analyserer forretningsdata for at udtrække kernebrandindsigter. Returner KUN gyldig JSON.

KRITISKE REGLER:
- Analyser al tekst på dansk og bevar danske vendinger præcist (f.eks. "ved åen" IKKE "ved floden")
- Oversæt IKKE danske udtryk til engelsk
- Bevar lokale kulturelle nuancer og terminologi
- Returner JSON med danske feltnavne og værdier`,
    instructionsPromptA: `Du er en senior brandstrateg med speciale i dansk gæstfrihed og lokale virksomheder.

Din opgave er at analysere tilgængelig information om en virksomhed og udtrække konkrete, forsvarlige brandsignaler, der senere kan bruges til at generere en Brandprofil.

KRITISKE REGLER:
- ❌ Skriv IKKE marketingkopi
- ❌ Overdrev IKKE
- ❌ Opfind IKKE fakta ud af den blå luft
- ✅ Foretræk konservativ fortolkning
- ✅ Hvis beviset er svagt, marker tillid som LAV
- ✅ Hvis der ikke findes bevis, flag som INSUFFICIENT_DATA
- ✅ Du MÅ gerne drage rimelige slutninger fra førstepartssignaler (menustruktur, billedindhold, websitelayout, booking-CTAs), men mærk dem som INFERRED

**Gylden Regel**: Hvis en påstand ikke er angivet af virksomheden selv OG ikke med rimelighed kan udledes af deres egen menu/billeder/sidestruktur, må du ikke promovere den til brandvished.

**Slutningseksempler** (TILLADT):
- "Godt til grupper" ← antydet af store delingsfade + gruppebookingprompter + bordebilleder, der viser 6+ personer
- "Brunch-til-middag-rytme" ← antydet af menusektioner (Morgenmad 08-11, Frokost 11-15, Middag 17-22)
- "Livlig aftenatmosfære" ← antydet af cocktailmenu + aftenambiance-fotos + sene åbningstider
- "Familievenlig" ← antydet af børnemenu + høje stole synlige på fotos + familieportioner

**KONTROLLERET TREDJEPART** (kun hvis tilladt):
Hvis allow_third_party_context=true, må du bruge følgende kilder med STOR forsigtighed:

✅ TILLADT tredjepart:
- Officielle turisme-/destinationssider (fx VisitAarhus, VisitCopenhagen)
- Google Business kategori/attributter (IKKE ratings eller anmeldelser)
- Venue-lister fra troværdige kilder (IKKE TripAdvisor-ratings)

❌ ALDRIG tilladt:
- Kundeanmeldelser, stjernebedømmelser
- "Prisvindende", "bedst i byen", popularitetspåstande
- Citater fra blogger eller influencers
- Konkurrent-sammenligninger

**Frasering for tredjepart** (OBLIGATORISK):
- "Ofte omtalt som..." / "Nævnes typisk som..."
- "Beskrives almindeligvis som..." / "Kendetegnes ofte ved..."
- "Listede kategorier inkluderer..."
- ALTID marker som LOW confidence
- ALTID tilføj source tag (fx "source: VisitAarhus listing")

Formålet: Give "liv" og kontekst uden at gøre det til absolut brandvished.`
  },
  'no': {
    code: 'no',
    name: 'Norwegian',
    countryMappings: ['NO', 'Norway'],
    systemPromptA: `Du er en merkevarestrategist som analyserer forretningsdata for å trekke ut kjerne merkevaresinnsikt. Returner KUN gyldig JSON.

KRITISKE REGLER:
- Analyser all tekst på norsk og bevar norske vendinger nøyaktig
- IKKE oversett norske uttrykk til engelsk
- Bevar lokale kulturelle nyanser og terminologi
- Returner JSON med norske feltnavn og verdier`,
    instructionsPromptA: `Du er en senior merkevarestrategist med spesialisering i norsk gjestfrihet og lokale virksomheter.

Din oppgave er å analysere tilgjengelig informasjon om en virksomhet og trekke ut konkrete, forsvarlige merkevaresignaler som senere kan brukes til å generere en Merkeprofil.

KRITISKE REGLER:
- ❌ Skriv IKKE markedsføringstekst
- ❌ Overdrev IKKE
- ❌ Oppdikt IKKE fakta fra intet
- ✅ Foretrekk konservativ tolkning
- ✅ Hvis beviset er svakt, merk tillit som LAV
- ✅ Hvis det ikke finnes bevis, flagg som INSUFFICIENT_DATA
- ✅ Du KAN gjøre rimelige slutninger fra førstepartssignaler (menystruktur, bildeinnhold, nettstedlayout, booking-CTAer), men merk dem som INFERRED

**Gylden Regel**: Hvis en påstand ikke er oppgitt av virksomheten selv OG ikke med rimelighet kan utledes av deres egen meny/bilder/sidestruktur, må du ikke promotere den til merkevaresannhet.

**KONTROLLERT TREDJEPART** (kun hvis tillatt):
Hvis allow_third_party_context=true, kan du bruke følgende kilder med STOR forsiktighet:

✅ TILLATT tredjepart:
- Offisielle turisme-/destinasjonssider (fx VisitNorway, VisitOslo)
- Google Business kategori/attributter (IKKE ratings eller anmeldelser)
- Venue-lister fra troverdige kilder (IKKE TripAdvisor-ratings)

❌ ALDRI tillatt:
- Kundeanmeldelser, stjernebedømmelser
- "Prisvinnende", "best i byen", popularitetspåstander
- Sitater fra bloggere eller influencere
- Konkurrent-sammenligninger

**Frasering for tredjepart** (OBLIGATORISK):
- "Ofte omtalt som..." / "Nevnes typisk som..."
- "Beskrives vanligvis som..." / "Kjennetegnes ofte ved..."
- "Listede kategorier inkluderer..."
- ALLTID marker som LOW confidence
- ALLTID legg til source tag (fx "source: VisitOslo listing")

Formål: Gi "liv" og kontekst uten å gjøre det til absolutt merkevaresannhet.`
  },
  'sv': {
    code: 'sv',
    name: 'Swedish',
    countryMappings: ['SE', 'Sweden'],
    systemPromptA: `Du är en varumärkesstrateg som analyserar företagsdata för att extrahera kärnvarumärkesinsikter. Returnera ENDAST giltig JSON.

KRITISKA REGLER:
- Analysera all text på svenska och bevara svenska uttryck exakt
- Översätt INTE svenska uttryck till engelska
- Bevara lokala kulturella nyanser och terminologi
- Returnera JSON med svenska fältnamn och värden`,
    instructionsPromptA: `Du är en senior varumärkesstrateg specialiserad på svensk gästfrihet och lokala företag.

Din uppgift är att analysera tillgänglig information om ett företag och extrahera konkreta, försvarbara varumärkessignaler som senare kan användas för att generera en Varumärkesprofil.

KRITISKA REGLER:
- ❌ Skriv INTE marknadsföringskopia
- ❌ Överdiv INTE
- ❌ Uppfinn INTE fakta från ingenstans
- ✅ Föredra konservativ tolkning
- ✅ Om bevisen är svaga, markera förtroende som LÅG
- ✅ Om inga bevis finns, flagga som INSUFFICIENT_DATA
- ✅ Du FÅR göra rimliga slutsatser från förstapartssignaler (menystruktur, bildinnehåll, webbplatslayout, boknings-CTAs), men märk dem som INFERRED

**Gyllene Regel**: Om ett påstående inte anges av företaget själv OCH inte rimligen kan härledas från deras egen meny/bilder/sidstruktur, får du inte befordra det till varumärkessanning.

**KONTROLLERAD TREDJE PART** (endast om tillåtet):
Om allow_third_party_context=true, får du använda följande källor med STOR försiktighet:

✅ TILLÅTEN tredje part:
- Officiella turist-/destinationssidor (t.ex. VisitSweden, VisitStockholm)
- Google Business kategori/attribut (INTE betyg eller recensioner)
- Venue-listor från trovärdiga källor (INTE TripAdvisor-betyg)

❌ ALDRIG tillåtet:
- Kundrecensioner, stjärnbetyg
- "Prisbelönt", "bäst i staden", popularitetspåståenden
- Citat från bloggare eller influencers
- Konkurrentjämförelser

**Frasering för tredje part** (OBLIGATORISKT):
- "Ofta omtalad som..." / "Nämns vanligtvis som..."
- "Beskrivs allmänt som..." / "Kännetecknas ofta av..."
- "Listade kategorier inkluderar..."
- ALLTID markera som LOW confidence
- ALLTID lägg till source tag (t.ex. "source: VisitStockholm listing")

Syfte: Ge "liv" och kontext utan att göra det till absolut varumärkessanning.`
  },
  'en': {
    code: 'en',
    name: 'English',
    countryMappings: ['UK', 'GB', 'United Kingdom', 'US', 'USA', 'United States'],
    systemPromptA: `You are a brand strategist analyzing business data to extract core brand insights. Return ONLY valid JSON.

CRITICAL RULES:
- Analyze text in English and preserve English phrasing exactly
- Do NOT translate cultural expressions or local terminology
- Preserve local nuances and context
- Return JSON with English field names and values`,
    instructionsPromptA: `You are a senior brand strategist specializing in local hospitality and small businesses.

Your task is to analyze available information about a business and extract concrete, defensible brand signals that can later be used to generate a Brand Profile.

CRITICAL RULES:
- ❌ Do NOT write marketing copy
- ❌ Do NOT exaggerate
- ❌ Do NOT invent facts from thin air
- ✅ Prefer conservative interpretation
- ✅ If evidence is weak, mark confidence as LOW
- ✅ If no evidence exists, flag as INSUFFICIENT_DATA
- ✅ You MAY make reasonable inferences from first-party signals (menu structure, image content, website layout, booking CTAs), but label them as INFERRED

**Golden Rule**: If a claim is not stated by the business itself AND cannot be reasonably inferred from their own menu/imagery/site structure, do not promote it into brand truth.

**Inference Examples** (ALLOWED):
- "Good for groups" ← implied by large sharing dishes + group booking prompts + table imagery showing 6+ people
- "Brunch-to-dinner rhythm" ← implied by menu sections (Breakfast 08-11, Lunch 11-15, Dinner 17-22)
- "Lively evening atmosphere" ← implied by cocktail menu + evening ambiance photos + late opening hours
- "Family-friendly" ← implied by kids menu + high chairs visible in photos + family-style portions

**CONTROLLED THIRD-PARTY** (only if allowed):
If allow_third_party_context=true, you may use the following sources with GREAT caution:

✅ ALLOWED third-party:
- Official tourism/destination sites (e.g., VisitBritain, local DMOs)
- Google Business category/attributes (NOT ratings or reviews)
- Venue listings from credible sources (NOT TripAdvisor ratings)

❌ NEVER allowed:
- Customer reviews, star ratings
- "Award-winning", "best in city", popularity claims
- Quotes from bloggers or influencers
- Competitor comparisons

**Phrasing for third-party** (MANDATORY):
- "Often described as..." / "Typically mentioned as..."
- "Commonly characterized as..." / "Frequently noted for..."
- "Listed categories include..."
- ALWAYS mark as LOW confidence
- ALWAYS add source tag (e.g., "source: VisitLondon listing")

Purpose: Add "life" and context without making it absolute brand truth.`
  }
}

// Additional country-to-language mappings (for countries without dedicated language configs)
const ADDITIONAL_COUNTRY_MAPPINGS: Record<string, string> = {
  'FI': 'en',       // Finland → English (no Finnish support yet)
  'Finland': 'en',
  'DE': 'en',       // Germany → English (no German support yet)
  'Germany': 'en',
  'FR': 'en',       // France → English (no French support yet)
  'France': 'en',
  'ES': 'en',       // Spain → English (no Spanish support yet)
  'Spain': 'en',
  'IT': 'en',       // Italy → English (no Italian support yet)
  'Italy': 'en',
  'NL': 'en',       // Netherlands → English (no Dutch support yet)
  'Netherlands': 'en',
  'PL': 'en',       // Poland → English (no Polish support yet)
  'Poland': 'en'
}

function getLanguageConfig(languageCode: string): LanguageConfig {
  return SUPPORTED_LANGUAGES[languageCode] || SUPPORTED_LANGUAGES['en']
}

function getLanguageFromCountry(country: string): LanguageConfig {
  // First check SUPPORTED_LANGUAGES for country mappings
  for (const config of Object.values(SUPPORTED_LANGUAGES)) {
    if (config.countryMappings.includes(country)) {
      return config
    }
  }
  
  // Then check ADDITIONAL_COUNTRY_MAPPINGS
  const langCode = ADDITIONAL_COUNTRY_MAPPINGS[country]
  if (langCode) {
    return SUPPORTED_LANGUAGES[langCode]
  }
  
  // Default to English
  return SUPPORTED_LANGUAGES['en']
}

// ============================================================================
// TYPES
// ============================================================================

interface BrandProfileRequest {
  businessId: string
  forceRegenerate?: boolean // Override existing profile
  allowThirdParty?: boolean // Enable controlled third-party context (default: false)
}

interface DataSources {
  // Tier 1 - Authoritative
  business: any
  profile: any
  menu: any[]
  images: any[]
  
  // Tier 2 - Supporting
  websiteAnalysis: any
  socialAccounts: any[]
}

interface InternalAnalysis {
  brandIdentity: {
    coreValues: string[]
    uniqueAttributes: string[]
    positioning: string
  }
  audienceInsights: {
    primaryDemographic: string
    needs: string[]
    language: string
  }
  offeringAnalysis: {
    topProducts: string[]
    serviceStyle: string
  }
  communicationPatterns: {
    toneSignals: string[]
    commonPhrases: string[]
    avoidancePatterns: string[]
  }
  confidence: {
    dataQuality: number // 0-1
    signalsFound: string[]
  }
}

type ImagePreferencesValue = {
  dos: string[]
  donts: string[]
  signature_shot: string
}

type ThingsToAvoidValue = {
  hard_constraints: string[]
  soft_suggestions: string[]
}

interface BrandVariable<TValue = string> {
  value: TValue
  confidence_score: number
  confidence_level: 'high' | 'inferred' | 'medium' | 'low'
  signals_used: string[]
}

interface BrandProfile {
  brand_essence: BrandVariable<string>
  tone_of_voice: BrandVariable<string>
  things_to_avoid: BrandVariable<ThingsToAvoidValue>
  target_audience: BrandVariable<string>
  core_offerings: BrandVariable<string>
  content_focus: BrandVariable<string>
  cta_style: BrandVariable<string>
  communication_goal: BrandVariable<string>
  image_preferences: BrandVariable<ImagePreferencesValue>
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // v2.2 - Converted Prompt B to JSON output for reliable parsing (no more fragile indexOf string matching)
  // v2.3 - Added controlled third-party context flag
  // v2.4 - Added must_use_phrases, concrete_anchors, disallowed_generic_words to make Prompt A output more actionable
  // v2.5 - Added hard evidence constraints: 2+ anchors per section, 6+ concrete nouns total, explicit gaps when evidence missing
  // v2.6 - Reduced Prompt B information overload: priority evidence only, full analysis moved to appendix (ignore unless needed)
  // v2.11 - Model optimization: Prompt B uses gpt-4o + temp 0.5 (more specific with evidence rules)
  // v3.1 - Production hardening: timeout, retry, request ID, DB error checks
  
  // Generate request ID for traceability
  const requestId = generateRequestId()
  const requestStartTime = Date.now()
  
  try {
    const { businessId, forceRegenerate = false, allowThirdParty = false } = await req.json()

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[${requestId}] 🎯 Starting brand profile generation for business:`, businessId)
    console.log(`[${requestId}] 🔧 Config:`, { forceRegenerate, allowThirdParty })

    // Verify API key is set
    if (!Deno.env.get('OPENAI_API_KEY')) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    console.log('✅ OpenAI API key is configured')

    // Check if profile already exists (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existing } = await supabaseClient
        .from('business_brand_profile')
        .select('brand_essence, tone_of_voice, things_to_avoid')
        .eq('business_id', businessId)
        .single()

      if (existing?.brand_essence || existing?.tone_of_voice) {
        console.log('⚠️  Brand profile already exists, skipping generation')
        return new Response(
          JSON.stringify({ 
            message: 'Brand profile already exists',
            existing: true 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Step 1: Gather data sources
    const dataGatherStart = Date.now()
    console.log(`[${requestId}] 📊 Gathering data sources...`)
    const dataSources = await gatherDataSources(supabaseClient, businessId)
    console.log(`[${requestId}] ✅ Data sources gathered in ${Date.now() - dataGatherStart}ms:`, {
      hasBusiness: !!dataSources.business,
      hasProfile: !!dataSources.profile,
      menuCount: dataSources.menu?.length || 0,
      hasWebsite: !!dataSources.websiteAnalysis
    })

    // Detect language from business data
    const language = detectBusinessLanguage(dataSources)
    console.log(`[${requestId}] 🌍 Detected business language: ${language.name} (${language.code})`)

    // Step 2: Run Prompt A - Internal Analysis
    const promptAStart = Date.now()
    console.log(`[${requestId}] 🔍 Running internal analysis (Prompt A)...`)
    let analysis = await runInternalAnalysis(dataSources, language, allowThirdParty, requestId)
    console.log(`[${requestId}] ✅ Internal analysis complete in ${Date.now() - promptAStart}ms`)

    // Step 2.5: Ensure must_use_phrases are never empty (Change #5)
    console.log(`[${requestId}] 🔧 Ensuring must_use_phrases have fallback anchors...`)
    analysis = ensureMustUsePhrasesFallback(analysis, dataSources)

    // Step 3: Run Prompt B - Brand Profile Generation
    const promptBStart = Date.now()
    console.log(`[${requestId}] ✨ Generating brand profile (Prompt B)...`)
    let brandProfile = await generateBrandProfile(dataSources, analysis, language, requestId)
    console.log(`[${requestId}] ✅ Brand profile generated in ${Date.now() - promptBStart}ms`)

    // Step 3.5: Final validation - strip any meta-text that slipped through (Change #7)
    console.log(`[${requestId}] 🔍 Running final validation...`)
    const finalValidation = validateFinalBrandProfile(brandProfile)
    if (!finalValidation.valid) {
      console.log(`[${requestId}] ⚠️ Final validation cleaned ${finalValidation.errors.length} issues`)
      brandProfile = finalValidation.cleaned
    } else {
      console.log(`[${requestId}] ✅ Final validation passed - no meta-text found`)
    }

    // Step 4: Save to database
    console.log(`[${requestId}] 💾 Saving brand profile...`)
    await saveBrandProfile(supabaseClient, businessId, brandProfile)

    const totalDuration = Date.now() - requestStartTime
    console.log(`[${requestId}] ✅ Brand profile generation complete in ${totalDuration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        durationMs: totalDuration,
        brandProfile: {
          brand_essence: brandProfile.brand_essence.value,
          tone_of_voice: brandProfile.tone_of_voice.value,
          things_to_avoid: brandProfile.things_to_avoid.value,
          target_audience: brandProfile.target_audience.value,
          core_offerings: brandProfile.core_offerings.value,
          content_focus: brandProfile.content_focus.value,
          cta_style: brandProfile.cta_style.value,
          communication_goal: brandProfile.communication_goal.value,
          image_preferences: brandProfile.image_preferences.value,
        },
        confidence: {
          brand_essence: brandProfile.brand_essence.confidence_level,
          tone_of_voice: brandProfile.tone_of_voice.confidence_level,
          things_to_avoid: brandProfile.things_to_avoid.confidence_level,
          target_audience: brandProfile.target_audience.confidence_level,
          core_offerings: brandProfile.core_offerings.confidence_level,
          content_focus: brandProfile.content_focus.confidence_level,
          cta_style: brandProfile.cta_style.confidence_level,
          communication_goal: brandProfile.communication_goal.confidence_level,
          image_preferences: brandProfile.image_preferences.confidence_level,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    const err = error as Error
    const totalDuration = Date.now() - requestStartTime
    console.error(`[${requestId}] ❌ Error generating brand profile after ${totalDuration}ms:`, err)
    console.error(`[${requestId}] Error stack:`, err.stack)
    console.error(`[${requestId}] Error details:`, {
      message: err.message,
      name: err.name,
      cause: (err as any).cause
    })
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate brand profile',
        requestId,
        durationMs: totalDuration,
        details: err.message,
        stack: err.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

function detectBusinessLanguage(dataSources: DataSources): LanguageConfig {
  const { business, profile } = dataSources

  // 1. Check primary_language field (if it exists)
  if (profile?.primary_language) {
    const langCode = profile.primary_language.toLowerCase()
    
    // Direct language code match
    if (SUPPORTED_LANGUAGES[langCode]) {
      return SUPPORTED_LANGUAGES[langCode]
    }
    
    // Language name match (e.g., "dansk" → "da")
    const langNameMap: Record<string, string> = {
      'dansk': 'da',
      'english': 'en',
      'norwegian': 'no',
      'norsk': 'no',
      'swedish': 'sv',
      'svenska': 'sv'
    }
    
    if (langNameMap[langCode]) {
      return SUPPORTED_LANGUAGES[langNameMap[langCode]]
    }
  }

  // 2. Infer from country
  const country = business?.country || profile?.country
  if (country) {
    return getLanguageFromCountry(country)
  }

  // 3. Default to Danish (existing behavior)
  return SUPPORTED_LANGUAGES['da']
}

// ============================================================================
// DATA GATHERING
// ============================================================================

async function gatherDataSources(
  supabase: any, 
  businessId: string
): Promise<DataSources> {
  // Fetch all data in parallel
  const [
    businessResult,
    profileResult,
    websiteResult,
    imagesResult,
    socialResult
  ] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('business_profile').select('*').eq('business_id', businessId).maybeSingle(),
    supabase.from('website_analyses').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('media_assets').select('id, type, category_tags, ai_labels, is_hero').eq('business_id', businessId).limit(20),
    supabase.from('social_accounts').select('platform, handle, profile_url').eq('business_id', businessId).eq('is_connected', true)
  ])

  // Check for errors on all queries
  if (businessResult.error) {
    throw new Error(`Failed to fetch business: ${businessResult.error.message}`)
  }
  if (profileResult.error) {
    console.warn('⚠️ Failed to fetch business_profile (non-fatal):', profileResult.error.message)
  }
  if (websiteResult.error) {
    console.warn('⚠️ Failed to fetch website_analyses (non-fatal):', websiteResult.error.message)
  }
  if (imagesResult.error) {
    console.warn('⚠️ Failed to fetch media_assets (non-fatal):', imagesResult.error.message)
  }
  if (socialResult.error) {
    console.warn('⚠️ Failed to fetch social_accounts (non-fatal):', socialResult.error.message)
  }

  // Extract menu data from business_profile.menu_structure (JSONB field)
  let menuItems: any[] = []
  if (profileResult.data?.menu_structure) {
    try {
      const menuStructure = typeof profileResult.data.menu_structure === 'string'
        ? JSON.parse(profileResult.data.menu_structure)
        : profileResult.data.menu_structure
      
      // Flatten categories into individual menu items
      if (Array.isArray(menuStructure)) {
        menuStructure.forEach((category: any) => {
          if (Array.isArray(category.items)) {
            category.items.forEach((item: any) => {
              menuItems.push({
                name: item.name,
                description: item.description || null,
                price: item.price || null,
                category: category.name || null,
                dietary: item.dietary || []
              })
            })
          }
        })
      }
      console.log(`✅ Extracted ${menuItems.length} menu items from menu_structure`)
    } catch (e) {
      console.error('Failed to parse menu_structure:', e)
    }
  } else {
    console.log('⚠️  No menu_structure found in business_profile')
  }

  return {
    business: businessResult.data,
    profile: profileResult.data,
    menu: menuItems,
    images: imagesResult.data || [],
    websiteAnalysis: websiteResult.data,
    socialAccounts: socialResult.data || []
  }
}

// ============================================================================
// PROMPT A - INTERNAL ANALYSIS (Heavy, Hidden)
// ============================================================================

// Helper function to extract structured website data (v2.7)
function extractStructuredWebsiteData(websiteAnalysis: any, business?: any): {
  headers: string[]
  ctaTexts: string[]
  valuePhrases: string[]
  menuCategoriesMentioned: string[]
  aboutTone: string
  rawExcerpt: string
} {
  if (!websiteAnalysis && !business?.website_analysis) {
    return {
      headers: [],
      ctaTexts: [],
      valuePhrases: [],
      menuCategoriesMentioned: [],
      aboutTone: 'N/A',
      rawExcerpt: ''
    }
  }

  const headers: string[] = []
  const ctaTexts: string[] = []
  const valuePhrases: string[] = []
  const menuCategoriesMentioned: string[] = []

  const fromArray = (v: any): string[] => Array.isArray(v) ? v.filter(Boolean).map((x: any) => String(x).trim()).filter(Boolean) : []
  const unique = (arr: string[]) => Array.from(new Set(arr.map(s => s.toLowerCase()))).map(k => arr.find(s => s.toLowerCase() === k)!).filter(Boolean)

  // Prefer new DB columns (true extracted structure)
  const columnHeaders = websiteAnalysis ? fromArray(websiteAnalysis.headers) : []
  const columnCtas = websiteAnalysis ? fromArray(websiteAnalysis.cta_texts) : []
  const columnNav = websiteAnalysis ? fromArray(websiteAnalysis.nav_items) : []
  const columnHero = websiteAnalysis ? fromArray(websiteAnalysis.hero_texts) : []

  // Fallback: extracted structure embedded in raw_result (from worker)
  const rawResult = (websiteAnalysis && websiteAnalysis.raw_result) || business?.website_analysis || null
  const rawExtracted = rawResult?.extracted || rawResult?.analysis?.extracted || null
  const extractedHeaders = fromArray(rawExtracted?.headers)
  const extractedCtas = fromArray(rawExtracted?.cta_texts)
  const extractedNav = fromArray(rawExtracted?.nav_items)
  const extractedHero = fromArray(rawExtracted?.hero_texts)

  headers.push(...columnHeaders, ...extractedHeaders)
  ctaTexts.push(...columnCtas, ...extractedCtas, ...extractedNav)

  // (Legacy fallbacks) Some pipelines used to store homepage/about content inside raw_result
  const homepageContent = rawResult?.analysis?.homepage_content || rawResult?.homepage_content || ''
  const aboutContent = rawResult?.analysis?.about_content || rawResult?.about_content || ''
  
  // If we have no extracted headers/ctas, do a last-resort heuristic scan on cleaned text
  const allText = (homepageContent + ' ' + aboutContent).trim()
  if (headers.length === 0 && allText) {
    const headerPatterns = [
      /(?:^|\n)#{1,3}\s+(.+?)(?:\n|$)/g,
      /\bH1:\s*(.+?)\s*###/g,
      /\bH2:\s*(.+?)\s*##/g,
    ]
    headerPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(allText)) !== null) {
        const headerText = String(match[1] || '').trim()
        if (headerText && headerText.length > 2 && headerText.length < 120) {
          headers.push(headerText)
        }
      }
    })
  }
  
  // Extract value phrases (short slogans, often in quotes or as taglines)
  // Look for phrases 3-8 words long that might be slogans
  const sentences = allText.split(/[.!?]\s+/)
  sentences.forEach(sentence => {
    const wordCount = sentence.trim().split(/\s+/).length
    if (wordCount >= 3 && wordCount <= 8) {
      const cleaned = sentence.trim()
      if (cleaned.length > 10 && cleaned.length < 80) {
        // Check if it looks like a value proposition (contains certain keywords)
        if (/(?:vi|vores|hos|velkommen|oplevelse|kvalitet|frisk|lokalt|håndlavet|authentic|experience|quality|fresh|local|handmade)/i.test(cleaned)) {
          valuePhrases.push(cleaned)
        }
      }
    }
  })
  
  // Extract menu categories mentioned (brunch, frokost, middag, cocktails, etc.)
  const menuKeywords = [
    'brunch', 'morgenmad', 'breakfast',
    'frokost', 'lunch',
    'middag', 'dinner', 'aftensmad',
    'dessert', 'eftermiddag',
    'cocktails', 'drinks', 'drikkevarer',
    'kaffe', 'coffee',
    'te', 'tea',
    'vin', 'wine',
    'øl', 'beer',
    'snacks', 'tapas',
    'menu', 'menukort',
    'à la carte',
    'take away', 'takeaway'
  ]
  
  menuKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    if (regex.test(allText)) {
      if (!menuCategoriesMentioned.includes(keyword.toLowerCase())) {
        menuCategoriesMentioned.push(keyword)
      }
    }
  })
  
  // Extract about tone summary
  const aboutTone = websiteAnalysis.tone || rawResult?.analysis?.tone || rawResult?.analysis?.brand_voice?.tone || 'N/A'
  
  // Keep a short raw excerpt as fallback
  const rawExcerpt = [
    columnHero.length || extractedHero.length ? `Hero: ${(columnHero.length ? columnHero : extractedHero).slice(0, 5).join(' | ')}` : '',
    allText ? allText.substring(0, 300) : ''
  ].filter(Boolean).join('\n') + (aboutContent ? '\n\nAbout: ' + aboutContent.substring(0, 200) : '')
  
  return {
    headers: unique(headers).slice(0, 12),
    ctaTexts: unique(ctaTexts).slice(0, 12),
    valuePhrases: valuePhrases.slice(0, 5),  // Top 5 value phrases
    menuCategoriesMentioned: menuCategoriesMentioned.slice(0, 10),  // Top 10 menu categories
    aboutTone,
    rawExcerpt
  }
}

// ============================================================================
// ENSURE MUST-USE PHRASES NEVER EMPTY (Change #5)
// ============================================================================

/**
 * Ensures must_use_phrases are never empty by filling with first-party fallback anchors.
 * This prevents Prompt B from generating generic/meta output when no direct quotes exist.
 * 
 * Fallback priority:
 * 1. Business name (always available)
 * 2. Location anchor ("ved åen", city name)
 * 3. Menu categories (Brunch, Frokost, Aften, etc.)
 * 4. CTA from nav/menu ("Book bord", "Se menukort")
 */
function ensureMustUsePhrasesFallback(
  analysis: any,
  dataSources: DataSources
): any {
  const { business, profile, menu, websiteAnalysis } = dataSources
  const signals = analysis.signals || {}
  
  // Build fallback anchor pool from first-party data
  const fallbackAnchors: string[] = []
  
  // 1. Business name (always use)
  const businessName = business?.business_name || business?.name
  if (businessName && businessName.length > 1 && businessName.toLowerCase() !== 'unknown') {
    fallbackAnchors.push(businessName)
  }
  
  // 2. Location anchor
  const city = business?.city || profile?.city
  if (city) {
    fallbackAnchors.push(city)
  }
  
  // Check for location-specific phrases in website content
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)
  const locationPhrases = ['ved åen', 'ved vandet', 'ved havnen', 'i centrum', 'på strøget', 'waterfront', 'by the river', 'downtown']
  const allWebsiteText = [...structuredWebsite.headers, ...structuredWebsite.ctaTexts, structuredWebsite.rawExcerpt].join(' ').toLowerCase()
  locationPhrases.forEach(phrase => {
    if (allWebsiteText.includes(phrase.toLowerCase())) {
      fallbackAnchors.push(phrase)
    }
  })
  
  // 3. Menu categories (top 3)
  const menuCategories = structuredWebsite.menuCategoriesMentioned.slice(0, 3)
  fallbackAnchors.push(...menuCategories)
  
  // Also extract categories from menu items
  const menuCategorySet = new Set<string>()
  menu.slice(0, 20).forEach(item => {
    if (item.category) {
      menuCategorySet.add(item.category)
    }
  })
  Array.from(menuCategorySet).slice(0, 3).forEach(cat => {
    if (!fallbackAnchors.some(a => a.toLowerCase() === cat.toLowerCase())) {
      fallbackAnchors.push(cat)
    }
  })
  
  // 4. CTAs from website (top 2)
  const ctaFallbacks = structuredWebsite.ctaTexts
    .filter(cta => cta.length > 3 && cta.length < 30) // Reasonable CTA length
    .filter(cta => !cta.toLowerCase().includes('link to')) // Filter out generic "Link to X"
    .slice(0, 2)
  fallbackAnchors.push(...ctaFallbacks)
  
  // 5. Headers (top 1-2 short ones)
  const headerFallbacks = structuredWebsite.headers
    .filter(h => h.length > 5 && h.length < 50)
    .slice(0, 2)
  fallbackAnchors.push(...headerFallbacks)
  
  // Deduplicate and clean
  const uniqueFallbacks = Array.from(new Set(
    fallbackAnchors
      .filter(Boolean)
      .map(a => a.trim())
      .filter(a => a.length > 1)
  ))
  
  console.log(`🔧 Fallback anchors available: ${uniqueFallbacks.length}`, uniqueFallbacks.slice(0, 8))
  
  // Now ensure each signal section has must_use_phrases
  const signalKeys = Object.keys(signals)
  let fillCount = 0
  
  signalKeys.forEach(key => {
    const signal = signals[key]
    if (!signal) return
    
    // Check if must_use_phrases is empty or missing
    const currentPhrases = signal.must_use_phrases || []
    const realPhrases = currentPhrases.filter((p: string) => 
      p && 
      p.trim().length > 2 && 
      !p.toLowerCase().includes('exact phrase') &&
      !p.toLowerCase().includes('placeholder') &&
      !p.toLowerCase().includes('n/a')
    )
    
    if (realPhrases.length === 0) {
      // Fill with fallbacks based on section type
      const sectionFallbacks: string[] = []
      
      switch (key) {
        case 'brand_essence':
          // Business name + location anchor
          if (businessName) sectionFallbacks.push(businessName)
          if (city) sectionFallbacks.push(city)
          if (uniqueFallbacks.length > 2) sectionFallbacks.push(uniqueFallbacks[2])
          break
          
        case 'tone_of_voice':
          // CTAs show tone
          sectionFallbacks.push(...ctaFallbacks.slice(0, 2))
          if (headerFallbacks.length > 0) sectionFallbacks.push(headerFallbacks[0])
          break
          
        case 'target_audience':
          // Menu categories indicate audience
          sectionFallbacks.push(...menuCategories.slice(0, 2))
          if (businessName) sectionFallbacks.push(businessName)
          break
          
        case 'core_offerings':
          // Menu categories are key
          sectionFallbacks.push(...menuCategories.slice(0, 3))
          sectionFallbacks.push(...ctaFallbacks.slice(0, 1))
          break
          
        case 'content_focus':
          // Headers + menu categories
          sectionFallbacks.push(...headerFallbacks.slice(0, 2))
          sectionFallbacks.push(...menuCategories.slice(0, 1))
          break
          
        case 'cta_style':
          // CTAs directly
          sectionFallbacks.push(...ctaFallbacks)
          if (ctaFallbacks.length < 2) {
            // Add common CTAs if we have few
            const commonCtas = ['Book bord', 'Se menu', 'Kontakt os', 'Læs mere']
            sectionFallbacks.push(...commonCtas.slice(0, 2 - ctaFallbacks.length))
          }
          break
          
        case 'communication_goal':
          // Business name + category
          if (businessName) sectionFallbacks.push(businessName)
          const category = business?.business_category || business?.vertical
          if (category) sectionFallbacks.push(category)
          break
          
        default:
          // Generic fallback: take first 2-3 from pool
          sectionFallbacks.push(...uniqueFallbacks.slice(0, 3))
      }
      
      // Deduplicate and limit
      const uniqueSectionFallbacks = Array.from(new Set(sectionFallbacks.filter(Boolean))).slice(0, 4)
      
      if (uniqueSectionFallbacks.length > 0) {
        signal.must_use_phrases = uniqueSectionFallbacks
        signal._fallback_applied = true
        fillCount++
        console.log(`  ↳ Filled ${key}.must_use_phrases with fallbacks:`, uniqueSectionFallbacks)
      }
    }
  })
  
  console.log(`✅ Fallback fill complete: ${fillCount} sections enriched`)
  
  return {
    ...analysis,
    signals
  }
}

async function runInternalAnalysis(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false,
  requestId: string = 'unknown'
): Promise<InternalAnalysis> {
  const prompt = buildPromptA(dataSources, language, allowThirdParty)
  
  const response = await fetchOpenAIWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODELS.analysis,
        messages: [
          {
            role: 'system',
            content: language.systemPromptA
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    },
    requestId,
    'Prompt A (Internal Analysis)'
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[${requestId}] OpenAI API error:`, response.status, errorText)
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    console.error(`[${requestId}] No content in OpenAI response:`, JSON.stringify(data))
    throw new Error('No response from AI')
  }

  // Parse JSON response
  try {
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleanedContent)
    console.log(`[${requestId}] ✅ Prompt A analysis parsed successfully`)
    return parsed
  } catch (parseError) {
    const err = parseError as Error
    console.error(`[${requestId}] Failed to parse Prompt A response:`, content)
    throw new Error(`Failed to parse AI response as JSON: ${err.message}`)
  }
}

function buildPromptA(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false
): string {
  const { business, profile, menu, images, websiteAnalysis, socialAccounts } = dataSources

  const menuSummary = menu.length > 0 
    ? menu.slice(0, 15).map(item => `- ${item.name}${item.description ? `: ${item.description}` : ''}${item.price ? ` (${item.price})` : ''}`).join('\n')
    : 'No menu data available'

  const imagesSummary = images.length > 0
    ? images.map(img => {
        const labels = img.ai_labels ? Object.values(img.ai_labels).flat().slice(0, 5).join(', ') : ''
        const tags = img.category_tags ? img.category_tags.join(', ') : ''
        return `- ${img.type}${img.is_hero ? ' (hero image)' : ''}${labels ? `: ${labels}` : ''}${tags ? ` [${tags}]` : ''}`
      }).join('\n')
    : 'No images uploaded'

  const socialSummary = socialAccounts.length > 0
    ? socialAccounts.map(acc => `- ${acc.platform}: ${acc.handle || acc.profile_url || 'connected'}`).join('\n')
    : 'No social accounts connected'

  // Extract structured website data (v2.7)
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)

  return `${language.instructionsPromptA}

---

THIRD-PARTY CONTEXT FLAG: allow_third_party_context=${allowThirdParty}

${allowThirdParty ? '✅ Third-party context is ENABLED. You may use approved sources with mandatory phrasing and LOW confidence.' : '❌ Third-party context is DISABLED. Use only first-party data (Tier 1 & 2).'}

---

INPUT DATA (STRICT PRIORITY ORDER):

TIER 1: INTERNAL DATA (Authoritative — Always Trust)

Business Snapshot:
- Business name: ${business?.business_name || 'Unknown'}
- Business type/category: ${business?.business_category || 'Unknown'}
- Location: ${business?.city || 'Unknown'}${business?.address ? `, ${business.address}` : ''}
- Country: ${business?.country || 'Unknown'}

User Profile (if provided):
${profile?.short_description ? `- Short description: ${profile.short_description}` : ''}
${profile?.long_description ? `- Long description: ${profile.long_description}` : ''}
${profile?.target_audience ? `- Target audience: ${profile.target_audience}` : ''}
${profile?.price_level ? `- Price level: ${profile.price_level}` : ''}

Menu Data (Tier 1):
${menuSummary}

Uploaded Images (Tier 1):
${imagesSummary}

TIER 2: EXTERNAL DATA (Supporting Only — Use Cautiously)

Website Analysis (if available):
${websiteAnalysis ? `
STRUCTURED WEBSITE DATA (Priority - extract exact phrases):
- Headers (H1/H2/H3): ${structuredWebsite.headers.length > 0 ? structuredWebsite.headers.join(' | ') : 'None found'}
- CTA Texts (buttons/links): ${structuredWebsite.ctaTexts.length > 0 ? structuredWebsite.ctaTexts.join(', ') : 'None found'}
- Value Phrases (slogans): ${structuredWebsite.valuePhrases.length > 0 ? structuredWebsite.valuePhrases.slice(0, 3).join(' | ') : 'None found'}
- Menu Categories Mentioned: ${structuredWebsite.menuCategoriesMentioned.length > 0 ? structuredWebsite.menuCategoriesMentioned.join(', ') : 'None found'}
- Detected Tone: ${structuredWebsite.aboutTone}
- Key Themes: ${websiteAnalysis.key_themes?.join(', ') || 'N/A'}

Raw Excerpt (reference if needed):
${structuredWebsite.rawExcerpt}
` : 'No website analysis available'}

Social Media Accounts (bios only):
${socialSummary}

${allowThirdParty ? `
TIER 3: CONTROLLED THIRD-PARTY (Use with phrasing rules + LOW confidence)

Google Business Category/Attributes (if available):
- Business category: ${business?.business_category || 'N/A'}
- Additional attributes: [To be populated from Google Business Profile API if available]

Official Tourism/Destination Listings (if available):
- [To be populated from VisitAarhus, VisitCopenhagen, etc. if available]
- Example: "Listed on VisitAarhus as: 'Cozy waterfront café known for brunch'"

REMEMBER: ALL third-party content MUST use phrasing like "Often described as...", "Typically mentioned as..." and be marked LOW confidence with source tags.

TIER 4: EXPLICITLY EXCLUDED
` : `
TIER 3: EXPLICITLY EXCLUDED (Third-party context disabled)
`}
❌ DO NOT USE: Customer reviews, star ratings, third-party blog posts, competitor mentions, claims not stated by the business itself.

---

ANALYSIS FRAMEWORK:

1. Evidence Signals
- Look for repeated words/phrases across sources
- Explicit positioning statements
- What the business emphasizes (visually + verbally)
- Language patterns (formal, casual, Danish, English mix)
- **EXTRACT EXACT PHRASES**: For each section, identify 3-8 must-use phrases (exact text from sources)
- **IDENTIFY CONCRETE ANCHORS**: Specific details like "ved åen", "brunch → middag", "cocktails/aften"
- **MULTI-SIGNAL THRESHOLD**: If a theme is supported by ≥2 different signal types (menu + location, image + text, website + menu), treat as SUFFICIENT evidence even if not explicitly stated. Examples: menu data + location anchor + images = valid content theme.

2. Positioning Context
- What type of business is this?
- Is it everyday, occasion-based, destination, or niche?
- Conservative differentiation (only if explicitly supported)

3. Audience Signals
- Who the business appears to speak to
- What problem it solves
- Avoid guessing demographics without evidence
- **FUNCTIONAL AUDIENCE INFERENCE**: If menu spans multiple dayparts (brunch + lunch + dinner), infer mixed audience (locals + visitors) with MEDIUM confidence. Menu breadth and daypart coverage indicate audience diversity even without explicit statements.

4. Content & Tone Signals
- Sentence length, formality level, emotional tone
- Danish vs English terminology ratio
- Personal vs corporate voice
- **FLAG GENERIC WORDS**: If evidence is weak, list generic words to avoid (fx "hyggelig", "lækker", "indbydende")
- **TONE-FROM-TEXT HEURISTIC**: If website/menu language uses short sentences, neutral adjectives, and functional descriptions → infer tone as 'rolig, imødekommende, ukompliceret' with MEDIUM confidence. This inference is valid even without explicit tone statements.

5. Menu & Offerings Discovery
- **CRITICAL**: Investigate homepage content for menu items, dishes, products, or services NOT listed in the Menu Data (Tier 1)
- Look for pricing, product names, specialty items, seasonal offerings
- Extract any food/drink items, services, or products mentioned on the website
- Cross-reference with existing menu data to identify NEW items
- Add discovered items to core_offerings signals
- **EXTRACT SPECIFIC DISH/PRODUCT NAMES**: These become must-use phrases

**CORE OFFERINGS STRUCTURE** (MANDATORY):
Separate offerings into two categories:

A) **Meal Anchors** (3 required):
- Daypart/meal types: brunch, morgenmad, frokost, lunch, middag, dinner, à la carte, menu, buffet
- Example: "Brunch 08-14", "3-retters middag", "À la carte frokost"

B) **Experience/Service Anchors** (2 required if found):
- Service types: takeaway, levering, catering, selskaber, private events, reservation
- Physical features: terrasse, udsigt, bar, lounge, outdoor seating
- Special offerings: cocktails, vin-pairing, dessertbar, gavekort, gift cards
- Atmosphere: live musik, DJ, family-friendly, pet-friendly
- If insufficient evidence: use category-typical neutral terms (e.g. "Bordreservation", "Takeaway") based on business type, then add gaps to internal_notes or clarifications (NOT in the core_offerings field itself)

**IMAGE PREFERENCES STRUCTURE** (MANDATORY):
Based on imageScenes (label analysis), create a mini-checklist:

A) **DO List** (3 required):
- What works visually: naturligt lys, mennesker i miljø, close-ups af signaturretter, action shots, golden hour
- Examples: "Natural light", "People enjoying food", "Close-ups of signature dishes", "Warm atmosphere"

B) **DON'T List** (3 required):
- What to avoid: stock photos, hård blitz, tomme lokaler, generic images, staged poses
- Examples: "No stock photos", "No harsh flash", "No empty spaces", "Avoid generic food shots"

C) **Signature Shot** (1 required):
- One iconic shot that captures brand essence
- Examples: "Bord ved åen i golden hour", "Bartender making cocktail", "Brunch table with morning light"
- If insufficient image data: provide a reasonable suggestion based on business type (e.g. "Food close-up with natural light"), then note the gap in internal_notes

**THINGS TO AVOID STRUCTURE** (MANDATORY):
Generate avoid-list in 2 layers:

A) **Hard Constraints** (evidence-based only):
- Explicit don'ts from business: "No [specific topic]", "Avoid [specific language]"
- Stated restrictions: "No alcohol promotion", "No health claims", "No competitor mentions"
- Only include if found in sources
- If none found: empty array []

B) **Soft Suggestions** (category best practices):
- Category norms for their business type
- Prefix with: "Som tommelfingerregel for [category]-indhold: undgå..."
- Examples for café: "undgå overdreven fine dining-retorik", "undgå claims om 'bedst i byen'"
- Examples for restaurant: "undgå stock food photos", "undgå generic 'fresh ingredients' claims"
- Provide 2-3 relevant suggestions based on business_category
- Mark clearly as suggestions, not facts

6. Constraints & Risks
- Topics or language to avoid (if explicitly mentioned)
- Over-promising risks
- Gaps in data

---

OUTPUT FORMAT (STRICT JSON):

Return ONLY valid JSON. No markdown, no code blocks, no explanations outside the JSON.

{
  "business_id": "${business?.id || 'unknown'}",
  "generated_at": "${new Date().toISOString()}",
  "analysis_version": "1.0",
  
  "signals": {
    "brand_essence": {
      "signals": ["Signal 1", "Signal 2", "Signal 3"],
      "notes": "Additional context",
      "must_use_phrases": ["exact phrase 1", "exact phrase 2", "exact phrase 3"],
      "concrete_anchors": ["specific detail 1", "specific detail 2"],
      "disallowed_generic_words": ["generic word 1", "generic word 2"]
    },
    "tone_of_voice": {
      "signals": ["Formality: casual | professional | formal", "Sentence style", "Language patterns"],
      "notes": "Tone patterns observed",
      "must_use_phrases": ["exact phrase from sources"],
      "concrete_anchors": ["specific tone indicators"],
      "disallowed_generic_words": ["words to avoid if no evidence"],
      "tone_markers_from_text": ["CTA word/phrase 1", "Specific phrasing 2", "Form of address (du/I/etc)"],
      "sentence_length_style": "short/medium/long + example sentence from actual text"
    },
    "target_audience": {
      "signals": ["Usage occasions from evidence", "Need/problem solved", "Language level"],
      "notes": "2+ concrete usage situations (brunch visit, frokostpause, aften, før/efter event, gåtur ved åen). Demographics ONLY if explicit.",
      "must_use_phrases": ["exact audience descriptions if stated"],
      "concrete_anchors": ["specific occasions/situations from evidence"],
      "disallowed_generic_words": ["lokale og turister", "sociale sammenkomster", "vague demographic terms"]
    },
    "core_offerings": {
      "signals": ["Top 3-5 products/services from menu data", "Additional items found on website", "Specialties", "Service style"],
      "notes": "What they sell and how - MUST include items discovered from homepage that aren't in menu database",
      "must_use_phrases": ["specific dish/product names", "signature items"],
      "concrete_anchors": ["menu categories", "price points", "specialty focus"],
      "disallowed_generic_words": ["avoid if no menu evidence"],
      "meal_anchors": ["Meal type 1 (brunch/frokost/middag)", "Meal type 2", "Meal type 3"],
      "experience_service_anchors": ["Experience/service 1 (cocktails/takeaway/terrasse)", "Experience/service 2 (clean, user-facing text)"]
    },
    "content_focus": {
      "signals": ["Topics emphasized", "Story themes", "Frequency"],
      "notes": "What they talk about",
      "must_use_phrases": ["recurring themes"],
      "concrete_anchors": ["specific topics"],
      "disallowed_generic_words": ["generic content words"]
    },
    "image_preferences": {
      "signals": ["Visual style", "People presence", "Composition"],
      "notes": "Visual patterns",
      "must_use_phrases": ["visual descriptors from images"],
      "concrete_anchors": ["specific visual elements"],
      "disallowed_generic_words": ["vague visual terms"],
      "image_dos": ["DO 1 (natural light/people/close-ups)", "DO 2", "DO 3"],
      "image_donts": ["DON'T 1 (stock/flash/empty)", "DON'T 2", "DON'T 3"],
      "signature_shot": "One iconic shot description (always provide a clean suggestion)"
    },
    "things_to_avoid": {
      "signals": ["Explicit don'ts", "Implicit constraints", "Category norms"],
      "notes": "Guardrails and red lines",
      "must_use_phrases": ["explicit constraints quoted"],
      "concrete_anchors": ["specific avoidance patterns"],
      "disallowed_generic_words": [],
      "hard_constraints": ["Hard 1 (explicit evidence)", "Hard 2 or empty if none"],
      "soft_suggestions": ["Soft 1 (category norm)", "Soft 2", "Soft 3"]
    },
    "cta_style": {
      "signals": ["CTA approach", "Action verbs used", "Frequency"],
      "notes": "How they ask for action",
      "must_use_phrases": ["exact CTA phrases found"],
      "concrete_anchors": ["specific action verbs"],
      "disallowed_generic_words": ["generic CTA words"]
    },
    "communication_goal": {
      "signals": ["Primary goal", "Success metric", "Brand vs performance"],
      "notes": "What they want to achieve",
      "must_use_phrases": ["goal statements"],
      "concrete_anchors": ["success indicators"],
      "disallowed_generic_words": ["vague goal terms"]
    }
  },
  
  "evidence": {
    "brand_essence": {
      "has_mission_statement": false,
      "has_about_page": false,
      "has_explicit_positioning": false,
      "brand_keywords_found": [],
      "sources": [],
      "supporting_quote": ""
    },
    "tone_of_voice": {
      "has_consistent_language": false,
      "formality_level": "unknown",
      "danish_vs_english_ratio": "unknown",
      "sentence_style": "unknown",
      "sources": [],
      "example_phrases": [],
      "tone_markers_from_text": [],
      "sentence_length_style": ""
    },
    "target_audience": {
      "has_explicit_audience_statement": false,
      "usage_occasions": [],
      "has_kids_menu": false,
      "has_group_offerings": false,
      "price_level_known": false,
      "explicit_demographics": [],
      "sources": []
    },
    "core_offerings": {
      "menu_items_count": 0,
      "has_specialties_mentioned": false,
      "website_additional_items_found": [],
      "categories_identified": [],
      "sources": []
    },
    "content_focus": {
      "has_website_themes": false,
      "recurring_topics": [],
      "sources": []
    },
    "image_preferences": {
      "images_uploaded_count": 0,
      "hero_images_count": 0,
      "visual_patterns": [],
      "lighting_style": "unknown",
      "composition_style": "unknown",
      "sources": []
    },
    "things_to_avoid": {
      "has_explicit_constraints": false,
      "explicit_donts": [],
      "sources": []
    },
    "cta_style": {
      "has_cta_examples": false,
      "action_verbs_found": [],
      "booking_prompts_found": false,
      "sources": []
    },
    "communication_goal": {
      "has_explicit_goal": false,
      "inferred_from_business_type": "",
      "sources": []
    }
  },
  
  "data_quality_summary": {
    "total_evidence_flags_true": 0,
    "strong_evidence_areas": [],
    "weak_evidence_areas": [],
    "missing_critical_data": [],
    "recommendations": []
  }
}

EVIDENCE-BASED CONFIDENCE SCORING:

For each brand variable, fill in the evidence flags truthfully based on what you actually find in the data.

The confidence score will be computed deterministically from your evidence flags:

Brand Essence:
- has_mission_statement (website/about): +0.4
- has_about_page: +0.2
- has_explicit_positioning (user profile): +0.3
- brand_keywords_found (3+ words): +0.1

Tone of Voice:
- has_consistent_language (same tone across 3+ sources): +0.4
- formality_level identified: +0.2
- example_phrases (5+ collected): +0.2

Target Audience:
- has_explicit_audience_statement: +0.4
- has_kids_menu OR has_group_offerings: +0.2 each
- price_level_known: +0.1
- inferred_demographics (with evidence): +0.2

Core Offerings:
- menu_items_count > 5: +0.3
- has_specialties_mentioned: +0.2
- website_additional_items_found: +0.2
- categories_identified: +0.1

Image Preferences:
- images_uploaded_count >= 3: +0.3
- hero_images_count >= 1: +0.2
- visual_patterns (3+ identified): +0.2

Things to Avoid:
- has_explicit_constraints: +0.5
- explicit_donts (list of 2+): +0.3

CTA Style:
- has_cta_examples: +0.3
- action_verbs_found (3+): +0.2
- booking_prompts_found: +0.2

Communication Goal:
- has_explicit_goal: +0.5
- inferred_from_business_type: +0.3

Level Mapping (computed from flags):
- High: ≥ 0.70 (explicit evidence, authoritative)
- Inferred: 0.50 - 0.69 (reasonable deduction from first-party signals)
- Medium: 0.40 - 0.49 (weak signals)
- Low: < 0.40 (very limited evidence)

IMPORTANT: Do NOT make up evidence flags. If something doesn't exist in the data, set it to false/0/empty.

---

FILLING THE NEW FIELDS:

**must_use_phrases**: Extract 3-8 exact phrases from the source data that MUST appear in the final Brand Profile.
- For brand_essence: Exact positioning statements, mission phrases, "about us" quotes
- For tone_of_voice: Actual sentences/phrases from website/profile that demonstrate tone
- For core_offerings: Exact dish names, product names, specialty items
- For target_audience: 2+ concrete usage occasions from evidence (brunch visit, lunch break, evening date, after concert, walk by river), NOT demographics unless explicit
- For CTA: Exact call-to-action phrases found ("Book bord", "Besøg os", etc.)
- Use empty array [] if no concrete phrases exist

**concrete_anchors**: 2-5 specific, non-generic details that ground the brand in reality.
- Examples: "ved åen", "brunch 08-14, middag 17-22", "cocktails/aften", "sharing plates", "family-style"
- Location details: "waterfront", "old town", "near harbor"
- Time/rhythm details: "all-day café", "evening cocktails", "brunch-to-dinner"
- Service style: "counter service", "table service", "takeaway focus"
- Use empty array [] if no concrete anchors found

**disallowed_generic_words**: Generic words to AVOID if there's insufficient evidence.
- Danish examples: "hyggelig", "lækker", "indbydende", "autentisk", "unik", "lokal oplevelse", "udsøgt", "afslappet", "perfekt spot", "kulinariske oplevelser", "ideelt sted", "gastronomisk", "smagfuld", "stemningsfuld", "charmerende", "fantastisk", "enestående", "sublime", "fortryllende", "magisk"
- English examples: "cozy", "delicious", "welcoming", "authentic", "unique", "amazing", "exquisite", "perfect spot", "culinary experiences", "ideal place", "gastronomic", "charming", "fantastic", "stunning", "magical", "wonderful", "exceptional"
- Norwegian: "koselig", "deilig", "innbydende", "utsøkt", "avslappet", "perfekt sted", "kulinariske opplevelser"
- Swedish: "mysig", "läcker", "inbjudande", "utsökt", "avslappnad", "perfekt ställe", "kulinariska upplevelser"
- ONLY include these if evidence is WEAK (confidence < 0.5)
- If evidence is strong, leave empty array []
- Purpose: Force Prompt B to use concrete language instead of marketing fluff

**meal_anchors** (core_offerings only): Extract 3 meal/daypart types.
- Examples: "Brunch 08-14", "À la carte frokost", "3-retters middag", "Morgenmad", "Lunch menu"
- Use exact phrases from menu data or website
- If fewer than 3 found, use generic: "Frokost" or "Middag"

**experience_service_anchors** (core_offerings only): Extract 2 experience/service features.
- Service: "Takeaway", "Catering", "Selskaber op til 40 personer", "Bordreservation"
- Physical: "Terrasse med 20 pladser", "Udsigt over åen", "Bar", "Lounge område"
- Special: "Cocktails", "Vin-pairing", "Gavekort", "Live musik fredage"
- NEVER include meta-text like "uklart om" or "verificer" in the output
- If insufficient evidence: use neutral category-typical terms, then add gap to clarifications_needed[]

**image_dos** (image_preferences only): Extract 3 visual best practices.
- Based on imageScenes labels: natural light, people in environment, food close-ups, golden hour, action shots
- Examples: "Natural light", "People enjoying meals", "Close-ups of signature dishes"
- If few images: use category defaults ("Food close-ups", "Warm lighting", "People in frame")

**image_donts** (image_preferences only): Extract 3 visual patterns to avoid.
- Anti-patterns: stock photos, harsh flash, empty spaces, generic angles, overly staged
- Examples: "No stock photos", "No harsh flash", "Avoid empty restaurant shots"
- Always provide 3 (use category defaults if needed)

**signature_shot** (image_preferences only): Describe 1 iconic shot.
- Combine location + offerings + lighting into one perfect shot
- Examples: "Bord ved åen i golden hour", "Bartender making cocktail", "Brunch spread with morning light"
- ALWAYS provide a clean, actionable shot description (never include "uklart" or meta-text)
- If insufficient data: suggest based on business type (e.g. "Food close-up with natural light")

**tone_markers_from_text** (tone_of_voice only): Extract 3 concrete tone markers.
- CTA words/phrases: "Book bord", "Se menu", "Kom forbi"
- Specific phrasings: "Vi elsker...", "Hos os finder du...", "Velkommen til..."
- Form of address: "du", "I", "De" (formal), or brand voice patterns
- Extract from actual website/menu text
- If insufficient: use generic based on business category

**sentence_length_style** (tone_of_voice only): Describe sentence structure with example.
- Format: "short/medium/long" + actual example sentence from text
- Examples: "short - 'Book bord. Se menu. Kom forbi.'", "medium - 'Vi serverer brunch fra kl. 08 hver weekend.'"
- Extract real example from sources, don't invent

**hard_constraints** (things_to_avoid only): Extract explicit avoid statements.
- Only from actual evidence: business profile text, website statements, explicit restrictions
- Examples: "No alcohol promotion", "Avoid health claims", "No competitor mentions"
- If none found: empty array []
- Never infer or guess

**soft_suggestions** (things_to_avoid only): Generate 2-3 category best practices.
- Based on business_category (café, restaurant, bar, etc.)
- Prefix format: "Som tommelfingerregel for [category]-indhold: undgå..."
- Café examples: "undgå overdreven fine dining-retorik", "undgå claims om 'bedst i byen'", "undgå stock photos"
- Restaurant examples: "undgå generic 'fresh ingredients' claims", "undgå overdreven Michelin-aspirations uden evidens"
- Bar examples: "undgå health claims om alkohol", "undgå 'party destination' hvis casual/lokal vibe"
- Always provide 2-3, tailored to business type` 
}

// ============================================================================
// VALIDATION & REPAIR
// ============================================================================

// Meta-text patterns that should NEVER appear in user-facing fields
// These are allowed ONLY in clarifications_needed or internal_notes
const META_TEXT_PATTERNS = [
  '(mangler tydelig evidens',
  'mangler tydelig evidens',
  'foreslået retning',
  'uklart om',
  'Uklart om',
  'insufficient evidence',
  'suggested direction',
  'unclear about',
  'needs verification',
  'verificer',
  'afklar',
  'TODO',
  '[TBD]',
  '[?]',
]

function validateBrandProfileOutput(sections: any, analysis: any): string[] {
  const errors: string[] = []
  
  // Extract disallowed generic words from analysis
  const disallowedWords = new Set<string>()
  if (analysis?.signals) {
    Object.values(analysis.signals).forEach((signal: any) => {
      if (signal?.disallowed_generic_words?.length > 0) {
        signal.disallowed_generic_words.forEach((word: string) => disallowedWords.add(word.toLowerCase()))
      }
    })
  }
  
  // Internal tokens that should never appear in user-facing content
  const internalTokens = [
    'MANDATORY',
    'HARD CONSTRAINTS',
    'SOM TOMMELFINGERREGEL',
    '[INTERNT',
    'MÅLTIDSANKRE',
    'OPLEVELSES-/SERVICEANKER',
    'CRITICAL',
    '(3 required)',
    '(2 required)',
    'required)'
  ]
  
  // Check each field for issues
  const fieldsToCheck = [
    'brand_essence',
    'tone_of_voice',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal'
  ]
  
  fieldsToCheck.forEach(field => {
    const value = sections[field]
    if (typeof value === 'string') {
      // Check for disallowed generic words
      if (disallowedWords.size > 0) {
        const valueLower = value.toLowerCase()
        disallowedWords.forEach(word => {
          if (valueLower.includes(word)) {
            errors.push(`Field "${field}" contains disallowed generic word: "${word}"`)
          }
        })
      }
      
      // Check for internal tokens
      internalTokens.forEach(token => {
        if (value.includes(token)) {
          errors.push(`Field "${field}" contains internal token: "${token}"`)
        }
      })
      
      // Check for meta-text patterns (Change #7)
      META_TEXT_PATTERNS.forEach(pattern => {
        if (value.toLowerCase().includes(pattern.toLowerCase())) {
          errors.push(`Field "${field}" contains meta-text: "${pattern}"`)
        }
      })
    }
  })
  
  // Check structured fields
  if (sections.image_preferences && typeof sections.image_preferences === 'object') {
    const allValues = [
      ...sections.image_preferences.dos,
      ...sections.image_preferences.donts,
      sections.image_preferences.signature_shot
    ].join(' ')
    
    internalTokens.forEach(token => {
      if (allValues.includes(token)) {
        errors.push(`Field "image_preferences" contains internal token: "${token}"`)
      }
    })
    
    // Check for meta-text in image_preferences (Change #7)
    META_TEXT_PATTERNS.forEach(pattern => {
      if (allValues.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Field "image_preferences" contains meta-text: "${pattern}"`)
      }
    })
  }
  
  if (sections.things_to_avoid && typeof sections.things_to_avoid === 'object') {
    const allValues = [
      ...sections.things_to_avoid.hard_constraints,
      ...sections.things_to_avoid.soft_suggestions
    ].join(' ')
    
    internalTokens.forEach(token => {
      if (allValues.includes(token)) {
        errors.push(`Field "things_to_avoid" contains internal token: "${token}"`)
      }
    })
    
    // Check for meta-text in things_to_avoid (Change #7)
    META_TEXT_PATTERNS.forEach(pattern => {
      if (allValues.toLowerCase().includes(pattern.toLowerCase())) {
        errors.push(`Field "things_to_avoid" contains meta-text: "${pattern}"`)
      }
    })
  }
  
  return errors
}

/**
 * Final validation on BrandProfile before saving (Change #7)
 * Runs on the parsed BrandProfile object to catch any meta-text that slipped through
 */
function validateFinalBrandProfile(brandProfile: BrandProfile): { valid: boolean; errors: string[]; cleaned: BrandProfile } {
  const errors: string[] = []
  const cleaned = { ...brandProfile }
  
  // User-facing fields that must NOT contain meta-text
  const userFacingFields: (keyof BrandProfile)[] = [
    'brand_essence',
    'tone_of_voice',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal'
  ]
  
  userFacingFields.forEach(field => {
    const variable = brandProfile[field]
    if (!variable) return
    
    const value = variable.value
    
    if (typeof value === 'string') {
      let cleanedValue = value
      let hadMetaText = false
      
      META_TEXT_PATTERNS.forEach(pattern => {
        if (cleanedValue.toLowerCase().includes(pattern.toLowerCase())) {
          errors.push(`[FINAL] Field "${field}" contains meta-text: "${pattern}"`)
          hadMetaText = true
          // Remove the meta-text pattern and surrounding context
          const regex = new RegExp(`\\([^)]*${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)|${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*\\.?`, 'gi')
          cleanedValue = cleanedValue.replace(regex, '').replace(/\s+/g, ' ').trim()
        }
      })
      
      if (hadMetaText) {
        (cleaned[field] as BrandVariable<string>).value = cleanedValue || '(awaiting input)'
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle structured fields like image_preferences, things_to_avoid
      const stringified = JSON.stringify(value)
      META_TEXT_PATTERNS.forEach(pattern => {
        if (stringified.toLowerCase().includes(pattern.toLowerCase())) {
          errors.push(`[FINAL] Field "${field}" (structured) contains meta-text: "${pattern}"`)
        }
      })
    }
  })
  
  // Special handling for image_preferences
  if (brandProfile.image_preferences?.value && typeof brandProfile.image_preferences.value === 'object') {
    const imgPref = brandProfile.image_preferences.value as ImagePreferencesValue
    const cleanedImgPref = { ...imgPref }
    let hadMetaText = false
    
    // Clean dos array
    if (Array.isArray(imgPref.dos)) {
      cleanedImgPref.dos = imgPref.dos.map(item => {
        let cleaned = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleaned.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleaned = cleaned.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleaned
      }).filter(item => item.length > 2)
    }
    
    // Clean donts array
    if (Array.isArray(imgPref.donts)) {
      cleanedImgPref.donts = imgPref.donts.map(item => {
        let cleaned = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleaned.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleaned = cleaned.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleaned
      }).filter(item => item.length > 2)
    }
    
    // Clean signature_shot
    if (typeof imgPref.signature_shot === 'string') {
      let cleanedSig = imgPref.signature_shot
      META_TEXT_PATTERNS.forEach(pattern => {
        if (cleanedSig.toLowerCase().includes(pattern.toLowerCase())) {
          hadMetaText = true
          cleanedSig = cleanedSig.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
        }
      })
      cleanedImgPref.signature_shot = cleanedSig || 'Signature shot pending'
    }
    
    if (hadMetaText) {
      (cleaned.image_preferences as BrandVariable<ImagePreferencesValue>).value = cleanedImgPref
    }
  }
  
  // Special handling for things_to_avoid
  if (brandProfile.things_to_avoid?.value && typeof brandProfile.things_to_avoid.value === 'object') {
    const avoid = brandProfile.things_to_avoid.value as ThingsToAvoidValue
    const cleanedAvoid = { ...avoid }
    let hadMetaText = false
    
    // Clean hard_constraints - these should only have explicit evidence-based constraints
    if (Array.isArray(avoid.hard_constraints)) {
      cleanedAvoid.hard_constraints = avoid.hard_constraints.map(item => {
        let cleaned = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleaned.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleaned = cleaned.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleaned
      }).filter(item => item.length > 2)
    }
    
    // Clean soft_suggestions
    if (Array.isArray(avoid.soft_suggestions)) {
      cleanedAvoid.soft_suggestions = avoid.soft_suggestions.map(item => {
        let cleaned = item
        META_TEXT_PATTERNS.forEach(pattern => {
          if (cleaned.toLowerCase().includes(pattern.toLowerCase())) {
            hadMetaText = true
            cleaned = cleaned.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
          }
        })
        return cleaned
      }).filter(item => item.length > 2)
    }
    
    if (hadMetaText) {
      (cleaned.things_to_avoid as BrandVariable<ThingsToAvoidValue>).value = cleanedAvoid
    }
  }
  
  if (errors.length > 0) {
    console.log(`⚠️ Final validation found ${errors.length} meta-text issues (auto-cleaned):`, errors)
  }
  
  return {
    valid: errors.length === 0,
    errors,
    cleaned
  }
}

async function repairBrandProfile(
  sections: any,
  errors: string[],
  language: LanguageConfig
): Promise<any> {
  const errorReport = errors.join('\n- ')
  
  const repairPrompt = `The following Brand Profile JSON contains errors. Rewrite ONLY the affected field values to fix these issues. Remove all meta-text, internal tokens, and disallowed generic words. Return clean, user-facing content only.

ERRORS FOUND:
- ${errorReport}

ORIGINAL JSON:
${JSON.stringify(sections, null, 2)}

INSTRUCTIONS:
1. Keep all field structure exactly the same
2. Rewrite only the values that have errors
3. Remove internal tokens like "MANDATORY", "HARD CONSTRAINTS", "[INTERNT", etc.
4. Replace disallowed generic words with concrete, specific language
5. Maintain the language: ${language.name}
6. Return complete corrected JSON

Return the corrected JSON now:`

  // Use timeout but not retry - repair has graceful fallback to original
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout for repair
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODELS.generation,
        messages: [
          {
            role: 'system',
            content: `You fix Brand Profile JSON by removing meta-text and replacing generic words with concrete language. Return valid JSON only.`
          },
          {
            role: 'user',
            content: repairPrompt
          }
        ],
        temperature: 0.3,  // Lower temp for repair - more deterministic
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('Repair call failed, returning original')
      return sections  // Return original if repair fails
    }

    const data = await response.json()
    const repairedContent = data.choices[0]?.message?.content

    if (!repairedContent) {
      console.error('No repair response, returning original')
      return sections
    }

    try {
      return JSON.parse(repairedContent)
    } catch (e) {
      console.error('Failed to parse repaired JSON, returning original')
      return sections
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const err = error as Error
    console.error('Repair call error (timeout or network), returning original:', err.message)
    return sections
  }
}

// ============================================================================
// PROMPT B - BRAND PROFILE GENERATION (Clean, User-Facing)
// v2.3: Added HIGHLIGHTED EVIDENCE section to surface top quotes/phrases from Prompt A
// v3.0: Change #9 - Switched to "concretization mode" - minimal rules in system, pure data in user prompt
// ============================================================================

// Ultra-short system prompt with core rules only
function buildSystemPromptB(language: LanguageConfig): string {
  return `You write Brand Profiles for small local businesses. Output: JSON only.

STYLE:
- Write in natural ${language.name}
- Use the business's OWN words from the data provided
- Be specific where evidence exists, neutral where it doesn't
- Sound like a helpful colleague, not a marketing agency

STRUCTURE (3+2 rule for core_offerings):
- 3 meal anchors (brunch, frokost, middag, etc.)
- 2 experience/service anchors (terrasse, takeaway, etc.)

BANNED WORDS (never use - empty marketing):
hyggelig, lækker, indbydende, autentisk, unik, udsøgt, afslappet, perfekt spot, kulinariske oplevelser, ideelt sted, gastronomisk, charmerende, fantastisk, cozy, delicious, welcoming, authentic, unique, amazing

GAPS:
- User-facing fields = always clean text
- Uncertainties go to clarifications_needed[] only
- Never write "(mangler evidens)" or "uklart om" in main fields`
}

async function generateBrandProfile(
  dataSources: DataSources,
  analysis: any, // Prompt A JSON output
  language: LanguageConfig,
  requestId: string = 'unknown'
): Promise<BrandProfile> {
  const prompt = buildPromptB(dataSources, analysis, language)
  
  // Define strict JSON schema for structured outputs
  const brandProfileSchema = {
    type: "object",
    properties: {
      brand_essence: {
        type: "string",
        description: "1-2 sentences describing uniqueness with concrete anchors",
        maxLength: 500
      },
      tone_of_voice: {
        type: "string",
        description: "Communication guidance with 2 concrete 'do-say' examples (sentences that could appear in a post)",
        maxLength: 700
      },
      target_audience: {
        type: "string",
        description: "Who they speak to. Focus on 2+ concrete usage occasions (brunch, lunch break, evening, after event, walk by river). Demographics only if explicit in evidence.",
        maxLength: 500
      },
      core_offerings: {
        type: "string",
        description: "Bulleted list: 3 meal anchors + 2 experience/service anchors",
        maxLength: 800
      },
      content_focus: {
        type: "string",
        description: "Content themes paragraph or bullets",
        maxLength: 600
      },
      image_preferences: {
        type: "object",
        properties: {
          dos: {
            type: "array",
            items: { type: "string", maxLength: 200 },
            minItems: 3,
            maxItems: 3,
            description: "3 visual best practices"
          },
          donts: {
            type: "array",
            items: { type: "string", maxLength: 200 },
            minItems: 3,
            maxItems: 3,
            description: "3 visual anti-patterns"
          },
          signature_shot: {
            type: "string",
            maxLength: 300,
            description: "One iconic shot description"
          }
        },
        required: ["dos", "donts", "signature_shot"],
        additionalProperties: false
      },
      things_to_avoid: {
        type: "object",
        properties: {
          hard_constraints: {
            type: "array",
            items: { type: "string", maxLength: 200 },
            description: "Explicit constraints from evidence only"
          },
          soft_suggestions: {
            type: "array",
            items: { type: "string", maxLength: 200 },
            minItems: 2,
            maxItems: 5,
            description: "Category best practices about communication/imagery/tone"
          }
        },
        required: ["hard_constraints", "soft_suggestions"],
        additionalProperties: false
      },
      cta_style: {
        type: "string",
        description: "How to invite action, use actual CTA verbs from website",
        maxLength: 500
      },
      communication_goal: {
        type: "string",
        description: "Desired outcome - positioning or performance goal",
        maxLength: 400
      },
      internal_notes: {
        type: "array",
        items: { type: "string", maxLength: 300 },
        description: "Internal clarifications or observations"
      },
      clarifications_needed: {
        type: "array",
        items: { type: "string", maxLength: 200 },
        description: "Data gaps that need verification"
      }
    },
    required: [
      "brand_essence",
      "tone_of_voice",
      "target_audience",
      "core_offerings",
      "content_focus",
      "image_preferences",
      "things_to_avoid",
      "cta_style",
      "communication_goal",
      "internal_notes",
      "clarifications_needed"
    ],
    additionalProperties: false
  }
  
  const response = await fetchOpenAIWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODELS.generation,
        messages: [
          {
            role: 'system',
            content: buildSystemPromptB(language)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,  // Lower than 0.7 to reduce template-like output with strong evidence-binding rules
        max_tokens: 3000,
        response_format: { 
          type: 'json_schema',
          json_schema: {
            name: 'brand_profile_response',
            schema: brandProfileSchema,
            strict: true
          }
        }
      }),
    },
    requestId,
    'Prompt B (Brand Profile Generation)'
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from AI')
  }

  // Parse JSON response with structured schema
  let sections = JSON.parse(content)
  
  // Validate and repair if needed
  const validationErrors = validateBrandProfileOutput(sections, analysis)
  if (validationErrors.length > 0) {
    console.log('Validation errors found, attempting repair:', validationErrors)
    sections = await repairBrandProfile(sections, validationErrors, language)
  }
  
  // Parse into BrandProfile structure
  return parseBrandProfileText(JSON.stringify(sections), analysis)
}

function buildPromptB(
  dataSources: DataSources,
  analysis: any,
  language: LanguageConfig
): string {
  const { business, profile, menu, images, websiteAnalysis, socialAccounts } = dataSources

  // Build rich menu details (top 12 items with descriptions)
  const menuDetails = menu.length > 0
    ? menu.slice(0, 12).map(item => {
        let detail = `- ${item.name}`
        if (item.description) detail += `: ${item.description}`
        if (item.price) detail += ` (${item.price})`
        if (item.category) detail += ` [${item.category}]`
        return detail
      }).join('\n')
    : 'No menu items available'

  // Build image scene descriptions from AI labels
  const imageScenes = images.length > 0
    ? images.slice(0, 5).map(img => {
        const labels = img.ai_labels ? Object.values(img.ai_labels).flat().slice(0, 5).join(', ') : 'no labels'
        const tags = img.category_tags ? img.category_tags.join(', ') : ''
        return `- ${img.type}${img.is_hero ? ' (HERO)' : ''}: ${labels}${tags ? ` [${tags}]` : ''}`
      }).join('\n')
    : 'No images uploaded'

  // Social media bio text (not just platform names)
  const socialBios = socialAccounts.length > 0
    ? socialAccounts.map(acc => `- ${acc.platform}: ${acc.handle || 'connected'}${acc.profile_url ? ` (${acc.profile_url})` : ''}`).join('\n')
    : 'No social accounts connected'

  // Extract structured website data (v2.7)
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis)
  
  // Build concise website summary for Prompt B
  const websiteExcerpts = websiteAnalysis ? `
Headers: ${structuredWebsite.headers.slice(0, 5).join(' | ') || 'None'}
CTAs: ${structuredWebsite.ctaTexts.slice(0, 5).join(', ') || 'None'}
Value Phrases: ${structuredWebsite.valuePhrases.slice(0, 3).join(' | ') || 'None'}
Menu Categories: ${structuredWebsite.menuCategoriesMentioned.join(', ') || 'None'}
Tone: ${structuredWebsite.aboutTone}
Key Themes: ${websiteAnalysis.key_themes?.join(', ') || 'N/A'}` : 'No website content available'

  // Extract highlighted evidence from Prompt A analysis
  const evidence = analysis.evidence || {}
  const signals = analysis.signals || {}
  
  const highlightedQuotes: string[] = []
  
  // Brand essence supporting quotes
  if (evidence.brand_essence?.supporting_quote) {
    highlightedQuotes.push(`[Brand Essence] "${evidence.brand_essence.supporting_quote}"`)
  }
  
  // Tone example phrases
  if (evidence.tone_of_voice?.example_phrases?.length > 0) {
    const phrases = evidence.tone_of_voice.example_phrases.slice(0, 3).map((p: string) => `"${p}"`).join(', ')
    highlightedQuotes.push(`[Tone Examples] ${phrases}`)
  }
  
  // Target audience supporting details
  if (evidence.target_audience?.usage_occasions?.length > 0) {
    highlightedQuotes.push(`[Usage Occasions] ${evidence.target_audience.usage_occasions.join(', ')}`)
  }
  if (evidence.target_audience?.explicit_demographics?.length > 0) {
    highlightedQuotes.push(`[Explicit Demographics] ${evidence.target_audience.explicit_demographics.join(', ')}`)
  }
  
  // Core offerings specialties
  if (evidence.core_offerings?.website_additional_items_found?.length > 0) {
    const items = evidence.core_offerings.website_additional_items_found.slice(0, 3).join(', ')
    highlightedQuotes.push(`[Additional Offerings Found] ${items}`)
  }
  
  // Visual patterns from images
  if (evidence.image_preferences?.visual_patterns?.length > 0) {
    highlightedQuotes.push(`[Visual Style] ${evidence.image_preferences.visual_patterns.join(', ')}`)
  }
  
  // Explicit constraints
  if (evidence.things_to_avoid?.explicit_donts?.length > 0) {
    highlightedQuotes.push(`[Explicit Constraints] ${evidence.things_to_avoid.explicit_donts.join(', ')}`)
  }
  
  // CTA action verbs
  if (evidence.cta_style?.action_verbs_found?.length > 0) {
    highlightedQuotes.push(`[CTA Verbs] ${evidence.cta_style.action_verbs_found.slice(0, 3).join(', ')}`)
  }
  
  const highlightedEvidence = highlightedQuotes.length > 0
    ? highlightedQuotes.map(q => `- ${q}`).join('\n')
    : 'No specific quotes or phrases extracted'

  // Extract MUST-USE PHRASES from signals (new in v2.4)
  const mustUsePhrases: Record<string, string[]> = {}
  const concreteAnchors: Record<string, string[]> = {}
  const disallowedWords: Record<string, string[]> = {}
  
  Object.keys(signals).forEach((key: string) => {
    const signal = signals[key]
    if (signal?.must_use_phrases?.length > 0) {
      mustUsePhrases[key] = signal.must_use_phrases
    }
    if (signal?.concrete_anchors?.length > 0) {
      concreteAnchors[key] = signal.concrete_anchors
    }
    if (signal?.disallowed_generic_words?.length > 0) {
      disallowedWords[key] = signal.disallowed_generic_words
    }
  })
  
  const mustUseSection = Object.keys(mustUsePhrases).length > 0
    ? Object.entries(mustUsePhrases)
        .map(([key, phrases]) => `${key}: ${phrases.map(p => `"${p}"`).join(', ')}`)
        .join('\n')
    : 'No mandatory phrases identified'
  
  const concreteAnchorsSection = Object.keys(concreteAnchors).length > 0
    ? Object.entries(concreteAnchors)
        .map(([key, anchors]) => `${key}: ${anchors.join(', ')}`)
        .join('\n')
    : 'No concrete anchors identified'
  
  const disallowedSection = Object.keys(disallowedWords).length > 0
    ? Object.entries(disallowedWords)
        .map(([key, words]) => `${key}: AVOID ${words.join(', ')} (insufficient evidence)`)
        .join('\n')
    : 'No generic words to avoid (evidence is strong)'

  // Build TOP SIGNALS summary (new in v2.6) - only the most important signals
  const topSignalsSummary: string[] = []
  Object.keys(signals).forEach((key: string) => {
    const signal = signals[key]
    if (signal?.signals?.length > 0) {
      const topSignals = signal.signals.slice(0, 3) // Only top 3 per category
      topSignalsSummary.push(`${key}: ${topSignals.join(' | ')}`)
    }
  })
  
  const topSignalsSection = topSignalsSummary.length > 0
    ? topSignalsSummary.join('\n')
    : 'No signals identified'

  // Extract example sentences from website (for v3.0 concretization mode)
  const exampleSentences: string[] = []
  if (evidence.tone_of_voice?.example_phrases?.length > 0) {
    exampleSentences.push(...evidence.tone_of_voice.example_phrases.slice(0, 3))
  }
  if (structuredWebsite.valuePhrases?.length > 0) {
    exampleSentences.push(...structuredWebsite.valuePhrases.slice(0, 2))
  }
  const exampleSentencesSection = exampleSentences.length > 0
    ? exampleSentences.map(s => `"${s}"`).join('\n')
    : 'None found'

  // v3.0: Pure data prompt - rules moved to system prompt
  return `Generate a Brand Profile for: ${business?.business_name || 'Unknown'} (${business?.business_category || 'Unknown'}) in ${business?.city || 'Unknown'}

---

**USE THESE PHRASES** (the business's own words - incorporate directly):
${mustUseSection}

**CONCRETE ANCHORS** (specific details to include):
${concreteAnchorsSection}

**TOP MENU ITEMS**:
${menuDetails}

**CTA TEXTS FROM WEBSITE**:
${structuredWebsite.ctaTexts.slice(0, 8).join(', ') || 'None found'}

**EXAMPLE SENTENCES FROM WEBSITE** (copy their style):
${exampleSentencesSection}

**WEBSITE HEADERS**:
${structuredWebsite.headers.slice(0, 6).join(' | ') || 'None'}

**MENU CATEGORIES MENTIONED**:
${structuredWebsite.menuCategoriesMentioned.join(', ') || 'None'}

---

**IMAGE VISUAL PATTERNS**:
${imageScenes}

**AVOID THESE GENERIC WORDS** (no evidence for them):
${disallowedSection}

---

**OUTPUT**: Return JSON with these fields:
- brand_essence (1-2 sentences)
- tone_of_voice (short paragraph with 2 "do-say" examples)
- target_audience (2+ usage occasions: brunch visits, evening dates, etc.)
- core_offerings (bullet list: 3 meal anchors + 2 experience anchors)
- content_focus (themes)
- image_preferences { dos: [3], donts: [3], signature_shot }
- things_to_avoid { hard_constraints: [], soft_suggestions: [2-5] }
- cta_style (use the CTA verbs above)
- communication_goal (1-2 sentences)
- internal_notes: []
- clarifications_needed: [] (put any gaps here, not in main fields)

Write in ${language.name}.`
}

// Compute confidence score from evidence flags (deterministic)
function computeConfidenceFromEvidence(variableName: string, evidence: any): { score: number; level: 'high' | 'inferred' | 'medium' | 'low' } {
  let score = 0.0

  switch (variableName) {
    case 'brand_essence':
      if (evidence.has_mission_statement) score += 0.4
      if (evidence.has_about_page) score += 0.2
      if (evidence.has_explicit_positioning) score += 0.3
      if (evidence.brand_keywords_found?.length >= 3) score += 0.1
      break

    case 'tone_of_voice':
      if (evidence.has_consistent_language) score += 0.4
      if (evidence.formality_level && evidence.formality_level !== 'unknown') score += 0.2
      if (evidence.example_phrases?.length >= 5) score += 0.2
      break

    case 'target_audience':
      if (evidence.has_explicit_audience_statement) score += 0.4
      if (evidence.has_kids_menu) score += 0.2
      if (evidence.has_group_offerings) score += 0.2
      if (evidence.price_level_known) score += 0.1
      if (evidence.inferred_demographics?.length > 0) score += 0.2
      break

    case 'core_offerings':
      if (evidence.menu_items_count > 5) score += 0.3
      if (evidence.has_specialties_mentioned) score += 0.2
      if (evidence.website_additional_items_found?.length > 0) score += 0.2
      if (evidence.categories_identified?.length > 0) score += 0.1
      break

    case 'content_focus':
      if (evidence.has_website_themes) score += 0.5
      if (evidence.recurring_topics?.length >= 3) score += 0.3
      break

    case 'image_preferences':
      if (evidence.images_uploaded_count >= 3) score += 0.3
      if (evidence.hero_images_count >= 1) score += 0.2
      if (evidence.visual_patterns?.length >= 3) score += 0.2
      break

    case 'things_to_avoid':
      if (evidence.has_explicit_constraints) score += 0.5
      if (evidence.explicit_donts?.length >= 2) score += 0.3
      break

    case 'cta_style':
      if (evidence.has_cta_examples) score += 0.3
      if (evidence.action_verbs_found?.length >= 3) score += 0.2
      if (evidence.booking_prompts_found) score += 0.2
      break

    case 'communication_goal':
      if (evidence.has_explicit_goal) score += 0.5
      if (evidence.inferred_from_business_type) score += 0.3
      break
  }

  // Cap at 1.0
  score = Math.min(score, 1.0)

  // Determine level
  let level: 'high' | 'inferred' | 'medium' | 'low'
  if (score >= 0.70) level = 'high'
  else if (score >= 0.50) level = 'inferred'
  else if (score >= 0.40) level = 'medium'
  else level = 'low'

  return { score, level }
}

function parseBrandProfileText(plainText: string, analysis: any): BrandProfile {
  // Parse JSON response from Prompt B
  let sections: any
  try {
    // Clean potential markdown wrapping
    const cleanedText = plainText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    sections = JSON.parse(cleanedText)
  } catch (parseError) {
    const err = parseError as Error
    console.error('Failed to parse Prompt B JSON:', plainText)
    throw new Error(`Failed to parse Brand Profile JSON: ${err.message}`)
  }

  // Get evidence flags from Prompt A analysis
  const evidence = analysis.evidence || {}

  // Compute confidence scores deterministically from evidence flags
  const confidenceScores = {
    brand_essence: computeConfidenceFromEvidence('brand_essence', evidence.brand_essence || {}),
    tone_of_voice: computeConfidenceFromEvidence('tone_of_voice', evidence.tone_of_voice || {}),
    target_audience: computeConfidenceFromEvidence('target_audience', evidence.target_audience || {}),
    core_offerings: computeConfidenceFromEvidence('core_offerings', evidence.core_offerings || {}),
    content_focus: computeConfidenceFromEvidence('content_focus', evidence.content_focus || {}),
    image_preferences: computeConfidenceFromEvidence('image_preferences', evidence.image_preferences || {}),
    things_to_avoid: computeConfidenceFromEvidence('things_to_avoid', evidence.things_to_avoid || {}),
    cta_style: computeConfidenceFromEvidence('cta_style', evidence.cta_style || {}),
    communication_goal: computeConfidenceFromEvidence('communication_goal', evidence.communication_goal || {})
  }

  // Build BrandProfile with computed confidence scores
  return {
    brand_essence: {
      value: sections.brand_essence || 'N/A',
      confidence_score: confidenceScores.brand_essence.score,
      confidence_level: confidenceScores.brand_essence.level,
      signals_used: evidence.brand_essence?.sources || []
    },
    tone_of_voice: {
      value: sections.tone_of_voice || 'N/A',
      confidence_score: confidenceScores.tone_of_voice.score,
      confidence_level: confidenceScores.tone_of_voice.level,
      signals_used: evidence.tone_of_voice?.sources || []
    },
    things_to_avoid: {
      value: (sections.things_to_avoid && typeof sections.things_to_avoid === 'object')
        ? {
            hard_constraints: Array.isArray(sections.things_to_avoid.hard_constraints) ? sections.things_to_avoid.hard_constraints : [],
            soft_suggestions: Array.isArray(sections.things_to_avoid.soft_suggestions) ? sections.things_to_avoid.soft_suggestions : []
          }
        : { hard_constraints: [], soft_suggestions: [] },
      confidence_score: confidenceScores.things_to_avoid.score,
      confidence_level: confidenceScores.things_to_avoid.level,
      signals_used: evidence.things_to_avoid?.sources || []
    },
    target_audience: {
      value: sections.target_audience || 'N/A',
      confidence_score: confidenceScores.target_audience.score,
      confidence_level: confidenceScores.target_audience.level,
      signals_used: evidence.target_audience?.sources || []
    },
    core_offerings: {
      value: sections.core_offerings || 'N/A',
      confidence_score: confidenceScores.core_offerings.score,
      confidence_level: confidenceScores.core_offerings.level,
      signals_used: evidence.core_offerings?.sources || []
    },
    content_focus: {
      value: sections.content_focus || 'N/A',
      confidence_score: confidenceScores.content_focus.score,
      confidence_level: confidenceScores.content_focus.level,
      signals_used: evidence.content_focus?.sources || []
    },
    cta_style: {
      value: sections.cta_style || 'N/A',
      confidence_score: confidenceScores.cta_style.score,
      confidence_level: confidenceScores.cta_style.level,
      signals_used: evidence.cta_style?.sources || []
    },
    communication_goal: {
      value: sections.communication_goal || 'N/A',
      confidence_score: confidenceScores.communication_goal.score,
      confidence_level: confidenceScores.communication_goal.level,
      signals_used: evidence.communication_goal?.sources || []
    },
    image_preferences: {
      value: (sections.image_preferences && typeof sections.image_preferences === 'object')
        ? {
            dos: Array.isArray(sections.image_preferences.dos) ? sections.image_preferences.dos : [],
            donts: Array.isArray(sections.image_preferences.donts) ? sections.image_preferences.donts : [],
            signature_shot: typeof sections.image_preferences.signature_shot === 'string' ? sections.image_preferences.signature_shot : ''
          }
        : { dos: [], donts: [], signature_shot: '' },
      confidence_score: confidenceScores.image_preferences.score,
      confidence_level: confidenceScores.image_preferences.level,
      signals_used: evidence.image_preferences?.sources || []
    }
  }
}



// ============================================================================
// DATABASE PERSISTENCE
// ============================================================================

async function saveBrandProfile(
  supabase: any,
  businessId: string,
  brandProfile: BrandProfile
) {
  const toJsonString = (value: unknown) => {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  const deriveCoreOfferingsJsonb = (coreOfferingsText: unknown) => {
    if (coreOfferingsText === null || coreOfferingsText === undefined) return null

    if (typeof coreOfferingsText === 'object') {
      return coreOfferingsText
    }

    if (typeof coreOfferingsText !== 'string') {
      return { raw_text: String(coreOfferingsText) }
    }

    const text = coreOfferingsText.trim()
    if (!text) return null

    // If it looks like JSON, try parsing (for forward/backward compatibility)
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        return JSON.parse(text)
      } catch {
        // fall through
      }
    }

    const lines = text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)

    const bullets = lines
      .filter(l => l.startsWith('- ') || l.startsWith('• '))
      .map(l => l.replace(/^[-•]\s+/, '').trim())
      .filter(Boolean)

    const unknowns: string[] = []
    const anchors: string[] = []

    for (const item of bullets) {
      if (/^uklart om\b/i.test(item) || /^unclear\b/i.test(item)) {
        unknowns.push(item)
      } else {
        anchors.push(item)
      }
    }

    return {
      meal_anchors: anchors.slice(0, 3),
      experience_service_anchors: anchors.slice(3, 5),
      unknowns,
      raw_text: text
    }
  }

  // Prepare data for database
  const profileData = {
    business_id: businessId,
    brand_essence: brandProfile.brand_essence.value,
    tone_of_voice: brandProfile.tone_of_voice.value,
    // Legacy TEXT columns (kept as fallback for older clients)
    things_to_avoid: toJsonString(brandProfile.things_to_avoid.value),
    target_audience: brandProfile.target_audience.value,
    core_offerings: brandProfile.core_offerings.value,
    content_focus: brandProfile.content_focus.value,
    cta_style: brandProfile.cta_style.value,
    communication_goal: brandProfile.communication_goal.value,
    image_preferences: toJsonString(brandProfile.image_preferences.value),

    // New JSONB columns (source of truth)
    things_to_avoid_jsonb: brandProfile.things_to_avoid.value,
    image_preferences_jsonb: brandProfile.image_preferences.value,
    core_offerings_jsonb: deriveCoreOfferingsJsonb(brandProfile.core_offerings.value),

    // TODO: Add after running ADD_LIFECYCLE_COLUMNS.sql migration:
    // generated_at: new Date().toISOString(),
    // last_edited_by: 'ai',
    // last_edited_at: new Date().toISOString()
  }

  // Save to database
  const { error } = await supabase
    .from('business_brand_profile')
    .upsert(profileData, { onConflict: 'business_id' })

  // Safety: if migrations haven't been applied yet in an environment, retry without the new JSONB columns.
  if (error) {
    const msg = String(error.message || '')
    const missingJsonbColumn =
      msg.includes('image_preferences_jsonb') ||
      msg.includes('things_to_avoid_jsonb') ||
      msg.includes('core_offerings_jsonb')

    if (missingJsonbColumn) {
      const legacyOnly = { ...profileData }
      delete (legacyOnly as any).image_preferences_jsonb
      delete (legacyOnly as any).things_to_avoid_jsonb
      delete (legacyOnly as any).core_offerings_jsonb

      const { error: retryError } = await supabase
        .from('business_brand_profile')
        .upsert(legacyOnly, { onConflict: 'business_id' })

      if (retryError) {
        throw new Error(`Failed to save brand profile (legacy retry): ${retryError.message}`)
      }

      console.log('✅ Brand profile saved to database (legacy columns only; JSONB columns missing)')
      return
    }

    throw new Error(`Failed to save brand profile: ${msg}`)
  }

  console.log('✅ Brand profile saved to database')
}
