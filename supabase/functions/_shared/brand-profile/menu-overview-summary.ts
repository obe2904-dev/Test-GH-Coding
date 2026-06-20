// ============================================================================
// CROSS-MENU SUMMARY GENERATOR
// ============================================================================
// Generates high-level overview across ALL menus for a business
// Uses GPT-4o-mini for cost-effective synthesis of existing AI summaries
// 
// Use case: Brand profile Layer 0 intelligence - business overview
// Cost: ~$0.0012 per business (very affordable)
// ============================================================================

import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts';

export interface MenuSummaryInput {
  service_period: string;
  ai_summary: string;
  item_count?: number;
  avg_price?: number;
  source_url?: string;
}

export interface MenuBreakdown {
  service_period: string;
  item_count: number;
  avg_price: number;
  ai_summary: string;
}

export interface CrossMenuSummary {
  cross_menu_summary: string;  // 5-6 bullet points synthesizing all menus
  gastronomic_profile?: string;  // Ultra-short 1-2 sentence profile (price level + style)
  total_items: number;
  total_menus: number;
  overall_avg_price: number;
  menu_breakdown: MenuBreakdown[];
  signature_themes: string[];  // Extracted themes (e.g., "Dansk tradition", "Plantebaseret")
  generated_at: string;
}

// ============================================================================
// GENERATE CROSS-MENU SUMMARY
// ============================================================================

export async function generateCrossMenuSummary(
  businessName: string,
  menuSummaries: MenuSummaryInput[],
  openaiClient: OpenAI,
  language: string = 'da'
): Promise<CrossMenuSummary | null> {
  
  // Validation: Need at least 2 menus for cross-summary
  if (!menuSummaries || menuSummaries.length < 2) {
    console.log('[CrossMenu] Skipping cross-summary: fewer than 2 menus');
    return null;
  }

  // Calculate aggregated statistics
  const totalMenus = menuSummaries.length;
  let totalItems = 0;
  let totalPriceSum = 0;
  let priceCount = 0;

  const menuBreakdown: MenuBreakdown[] = menuSummaries.map(menu => {
    const itemCount = menu.item_count || 0;
    const avgPrice = menu.avg_price || 0;
    
    totalItems += itemCount;
    
    if (avgPrice > 0) {
      totalPriceSum += avgPrice;
      priceCount++;
    }
    
    return {
      service_period: menu.service_period,
      item_count: itemCount,
      avg_price: avgPrice,
      ai_summary: menu.ai_summary
    };
  });

  const overallAvgPrice = priceCount > 0 ? Math.round(totalPriceSum / priceCount) : 0;

  console.log(`[CrossMenu] Generating summary for ${totalMenus} menus, ${totalItems} total items`);

  // Build prompt for AI
  const prompt = buildCrossMenuPrompt(businessName, menuBreakdown, language);

  // Generate with AI
  const aiResult = await generateWithAI(prompt, openaiClient, language);

  if (!aiResult) {
    console.warn('[CrossMenu] AI generation failed, returning null');
    return null;
  }

  // Generate ultra-short gastronomic profile (1-2 sentences)
  const gastronomicProfile = await generateGastronomicProfile(aiResult.summary, openaiClient, language);

  return {
    cross_menu_summary: aiResult.summary,
    gastronomic_profile: gastronomicProfile,
    total_items: totalItems,
    total_menus: totalMenus,
    overall_avg_price: overallAvgPrice,
    menu_breakdown: menuBreakdown,
    signature_themes: aiResult.signature_themes,
    generated_at: new Date().toISOString()
  };
}

// ============================================================================
// BUILD PROMPT
// ============================================================================

function buildCrossMenuPrompt(
  businessName: string,
  menuBreakdown: MenuBreakdown[],
  language: string
): string {
  
  const languageLabel = language === 'da' ? 'dansk' :
                       language === 'en' ? 'engelsk' :
                       language === 'sv' ? 'svensk' :
                       language === 'no' ? 'norsk' :
                       language === 'de' ? 'tysk' : 'dansk';

  // Build menu breakdown text
  const menuBreakdownText = menuBreakdown.map((menu, idx) => {
    const priceText = menu.avg_price > 0 ? ` · Ø ${menu.avg_price} DKK` : '';
    return `${idx + 1}. ${menu.service_period}: ${menu.item_count} items${priceText}
   ${menu.ai_summary}`;
  }).join('\n\n');

  return `Du er gastronomisk konsulent med indsigt i kulinariske trends og menupositionering.

${businessName}
${menuBreakdownText}

OPGAVE: Konsolidér alle menu-analyser til samlet kulinarisk identitet.

Identificer:
- Hvilke madkulturer eller stile kombineres på tværs af menuer?
- Hvilke signatur-elementer eller unikke tilbud definerer stedet?
- Service-model: All-day, brunch-fokus, bar-program?

Illustrer med konkrete eksempler i parentes hvor relevant.

GODT: "Dansk madkultur (smørrebrød, pariserbøf) møder international café (falafel, eggs benedict)"
DÅRLIGT: "Moderne tilgang med fokus på variation" (for generisk)

REGLER:
- Faktuel analyse - ingen subjektive ord
- Syntetiser højniveau-mønstre fra alle menu-analyser
- Brug konkrete eksempler sparsomt til at illustrere karakter
- Start DIREKTE med første bullet - ingen introduktion

SIGNATUR-TEMAER:
- Vælg 2-10 labels baseret på etablissementets kompleksitet
- Tilpas antal efter hvor mange unikke karakteristika der faktisk findes
- Du må opfinde nye labels hvis de beskriver stedet præcist

Returner JSON:
{
  "summary": "• Bullet 1\\n• Bullet 2\\n...",
  "signature_themes": ["Label 1", "Label 2", ...]
}`;
}

// ============================================================================
// GENERATE WITH AI
// ============================================================================

async function generateWithAI(
  prompt: string,
  openaiClient: OpenAI,
  language: string
): Promise<{ summary: string; signature_themes: string[] } | null> {
  
  try {
    const languageName = language === 'da' ? 'Danish' :
                        language === 'en' ? 'English' :
                        language === 'sv' ? 'Swedish' :
                        language === 'no' ? 'Norwegian' :
                        language === 'de' ? 'German' : 'Danish';

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',  // Upgraded from gpt-4o-mini for consistency with Stage 2
      response_format: { type: "json_object" },  // Force JSON output
      messages: [
        {
          role: 'system',
          content: language === 'da' 
            ? `Du er gastronomisk konsulent. Syntetiser etablissementets kulinariske identitet til persona-generation.

Regler:
- Faktuel analyse med karakter-rige observationer
- Brug eksempler i parentes til at illustrere stil, ikke sælge retter
- Opfind intet - kun hvad der fremgår af menu-data
- Returner valid JSON med "summary" og "signature_themes"

Kvalitet:
✅ "Traditionel dansk madkultur (smørrebrød, pariserbøf) kombineret med international café (falafel, eggs benedict)"
✅ "In-house produktion som differentiation (hjemmelavede pandekager, egen hakkebøf)"
❌ "Lækre retter" (subjektivt sprog)
❌ "Vi tilbyder Pariserbøf og FAVORITTEN" (sælger specifikke retter)`
            : `You are a gastronomic consultant. Synthesize the establishment's culinary identity for persona generation.

Rules:
- Factual analysis with character-rich observations
- Use examples in parentheses to illustrate style, not sell dishes
- Invent nothing - only what appears in menu data
- Return valid JSON with "summary" and "signature_themes"

Quality:
✅ "Traditional cuisine (smørrebrød, classics) combined with international café (falafel, eggs benedict)"
✅ "In-house production as differentiation (homemade pancakes, house-made patties)"
❌ "Delicious dishes" (subjective language)
❌ Promoting specific dishes`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,  // Balanced creativity
      max_tokens: 500  // Increased for JSON structure
    });

    const result = completion.choices[0].message.content?.trim();
    
    if (!result) {
      throw new Error('Empty AI response');
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (e) {
      console.error('[CrossMenu] Failed to parse JSON response:', result);
      throw new Error('Invalid JSON from AI');
    }

    // Validate structure
    if (!parsed.summary || !parsed.signature_themes) {
      throw new Error('Missing required fields in AI response');
    }

    // Validate summary has bullet points
    if (!parsed.summary.includes('•')) {
      console.warn('[CrossMenu] AI summary missing bullets, may need reformatting');
    }

    // Log metrics (no strict validation - trust AI judgment)
    const wordCount = parsed.summary.split(/\s+/).length;
    console.log(`[CrossMenu] AI summary: ${wordCount} words, ${parsed.signature_themes.length} themes`);
    
    // Only warn on extreme outliers
    if (wordCount < 30 || wordCount > 400) {
      console.warn(`[CrossMenu] Unusual summary length: ${wordCount} words`);
    }
    
    if (parsed.signature_themes.length < 1 || parsed.signature_themes.length > 15) {
      console.warn(`[CrossMenu] Unusual theme count: ${parsed.signature_themes.length}`);
    }
    
    return parsed;
    
  } catch (error) {
    console.error('[CrossMenu] AI generation failed:', error);
    return null;
  }
}

// ============================================================================
// EXTRACT SIGNATURE THEMES (DEPRECATED - NOW AI-GENERATED)
// ============================================================================
// This function is no longer used. Signature themes are now generated directly
// by AI as part of the structured JSON response, providing custom labels
// tailored to each establishment instead of keyword-based pattern matching.
//
// Kept for reference in case we need to revert to keyword-based approach.
// ============================================================================

/*
function extractSignatureThemes(
  crossSummary: string,
  menuBreakdown: MenuBreakdown[]
): string[] {
  
  const themes: string[] = [];
  const summaryLower = crossSummary.toLowerCase();
  
  // Common theme patterns to detect (Danish labels)
  const themePatterns = [
    { keywords: ['familie', 'børne'], theme: 'Familievenlig' },
    { keywords: ['all-day', 'hele dagen', 'morgenmad til'], theme: 'All-day dining' },
    { keywords: ['dansk', 'traditionel', 'klassisk'], theme: 'Dansk tradition' },
    { keywords: ['international', 'verden', 'global'], theme: 'International' },
    { keywords: ['casual', 'afslappet', 'uformel'], theme: 'Casual dining' },
    { keywords: ['fine dining', 'gourmet', 'eksklusive'], theme: 'Fine dining' },
    { keywords: ['cocktail', 'bar', 'drinks', 'drikkekort', 'drikkeudvalg'], theme: 'Bar-program' },
    { keywords: ['brunch'], theme: 'Brunch-specialist' },
    { keywords: ['frokost', 'lunch', 'lette retter'], theme: 'Frokost-fokus' },
    { keywords: ['aften', 'aftensmad', 'middag', 'dinner'], theme: 'Aftensmad' },
    { keywords: ['vegetar', 'vegan', 'plantebaseret'], theme: 'Plantebaseret' },
    { keywords: ['lokale', 'årstid', 'sæson'], theme: 'Sæsonbaseret & lokalt' },
    { keywords: ['takeaway', 'take away', 'levering'], theme: 'Takeaway & levering' }
  ];
  
  // Check each pattern
  for (const pattern of themePatterns) {
    if (pattern.keywords.some(keyword => summaryLower.includes(keyword))) {
      themes.push(pattern.theme);
    }
  }
  
  // Check menu counts for additional themes
  if (menuBreakdown.length >= 4) {
    themes.push('Omfattende udvalg');
  }
  
  // Check if multiple service periods mentioned
  const servicePeriods = menuBreakdown.map(m => m.service_period.toLowerCase());
  const uniquePeriods = new Set(servicePeriods);
  if (uniquePeriods.size >= 3) {
    themes.push('Flere serviceperioder');
  }
  
  console.log(`[CrossMenu] Extracted ${themes.length} signature themes:`, themes);
  
  return themes;
}
*/

// ============================================================================
// GENERATE GASTRONOMIC PROFILE
// ============================================================================

async function generateGastronomicProfile(
  crossMenuSummary: string,
  openaiClient: OpenAI,
  language: string
): Promise<string | null> {
  
  try {
    console.log('[GastronomicProfile] Generating ultra-short profile...');

    const prompt = language === 'da'
      ? `Tag følgende råpunkter om menukortet og lav en ultra-kort, faktuel profilering af stedets gastronomiske identitet på 1-2 sætninger. Vurder ud fra teksten, hvor de ligger på parametre som prisniveau (f.eks. budget, mellemklasse, high-end) og stil (f.eks. klassisk vs. moderne), og skær helt ind til benet uden salgsgas.

Menupunkter:
${crossMenuSummary}

Returner KUN 1-2 korte, faktuelle sætninger.`
      : `Take the following menu bullet points and create an ultra-short, factual profiling of the establishment's gastronomic identity in 1-2 sentences. Evaluate based on the text where they fall on parameters such as price level (e.g., budget, mid-range, high-end) and style (e.g., classic vs. modern), and cut straight to the bone without sales language.

Menu points:
${crossMenuSummary}

Return ONLY 1-2 short, factual sentences.`;

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: language === 'da'
            ? 'Du er gastronomisk analytiker. Lav ultra-korte, faktuelle profiler uden salgsgas. 1-2 sætninger kun.'
            : 'You are a gastronomic analyst. Create ultra-short, factual profiles without sales language. 1-2 sentences only.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,  // Lower temperature for factual output
      max_tokens: 100
    });

    const result = completion.choices[0].message.content?.trim();
    
    if (!result) {
      console.warn('[GastronomicProfile] Empty AI response');
      return null;
    }

    console.log(`[GastronomicProfile] Generated: ${result.length} chars`);
    
    return result;
    
  } catch (error) {
    console.error('[GastronomicProfile] AI generation failed:', error);
    return null;
  }
}
