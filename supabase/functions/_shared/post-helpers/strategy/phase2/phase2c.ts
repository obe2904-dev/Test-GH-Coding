/**
 * PHASE 2c: NARRATIVE GENERATOR
 *
 * Generates headline, overview and detailed_sections.
 * Separate call → short prompt → better quality.
 *
 * Uses Gemini 2.5 Flash with thinking budget.
 */

import type { WeekContext, StrategicBrief, ContextualAnalysis, ContextFactor } from '../../types/strategy-types.ts';
import { callGeminiWithRetry } from '../infrastructure.ts';
import { silentSpellingCorrection } from '../infrastructure.ts';
import { translateCondition, translateEconomicPattern } from '../platform-helpers.ts';

export async function generateNarrative(
  context: WeekContext,
  strategicBrief: StrategicBrief,
  postSummary: Array<{ type: string; title: string; angle_focus: string; suggested_day: string; rationale?: string }>,
  phase0Analysis: ContextualAnalysis,
): Promise<any> {

  const t0 = performance.now();

  // Sort by weight descending so primary angle is always first
  const sortedAngles = [...strategicBrief.angles].sort((a, b) => b.weight - a.weight);
  const primaryAngle = sortedAngles[0];
  const supportAngles = sortedAngles.slice(1, 3); // Top 2–3 supporting angles

  const primaryAngleSummary = primaryAngle
    ? `${primaryAngle.focus} (${Math.round(primaryAngle.weight * 100)}% — PRIMÆR): ${primaryAngle.reasoning}\n  Indholdsretning: ${primaryAngle.content_direction}`
    : '';
  // Label used directly in headline rule so the model cannot invent a different theme
  const primaryAngleLabel = primaryAngle?.focus ?? '';

  const supportAnglesSummary = supportAngles.length > 0
    ? supportAngles.map(a => `${a.focus} (${Math.round(a.weight * 100)}%): ${a.reasoning}`).join('\n')
    : '';

  const weekSummaryText = strategicBrief.week_summary || '';
  const competitiveAdvText = strategicBrief.competitive_advantage || '';

  // Keep full anglesSummary for backward-compatible internal logging
  const anglesSummary = sortedAngles
    .map(a => `${a.focus} (${Math.round(a.weight * 100)}%): ${a.reasoning}`)
    .join('\n');

  // Type + timing distribution — titles are hidden to prevent the model from
  // reverse-engineering a generic narrative from the post list.
  // angle_focus IS included so Phase 2c can see which service periods are covered
  // (e.g. evening + brunch + lunch) and write an overview that reflects the full week.
  // Scheduled day names are explicitly listed so Phase 2c cannot reference unscheduled days.
  const _dkWeekdaysLong = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
  const actualScheduledDays = [...new Set(
    postSummary.map(p => _dkWeekdaysLong[new Date(p.suggested_day + 'T00:00:00').getDay()])
  )].join(', ');

  const plannedMixSummary = (() => {
    const daypartLabel = (day: string): string => {
      const d = new Date(day);
      const wd = d.getDay(); // 0=sun
      if (wd === 0 || wd === 6) return 'weekend';
      return 'hverdag';
    };
    const typeTally: Record<string, number> = {};
    const daypartTally: Record<string, number> = {};
    const seenAngles: string[] = [];
    for (const p of postSummary) {
      typeTally[p.type] = (typeTally[p.type] || 0) + 1;
      const dp = daypartLabel(p.suggested_day);
      daypartTally[dp] = (daypartTally[dp] || 0) + 1;
      if (p.angle_focus && !seenAngles.includes(p.angle_focus)) {
        seenAngles.push(p.angle_focus);
      }
    }
    const typeLines = Object.entries(typeTally).map(([t, n]) => `${n} ${t}-post${n > 1 ? 's' : ''}`);
    const daypartLines = Object.entries(daypartTally).map(([d, n]) => `${n} ${d}`);
    const summary = [...typeLines, ...daypartLines].join(', ');
    // Attach unique angle_focus values (truncated) so Phase 2c sees which service
    // periods the posts actually cover — critical when mix includes evening/brunch
    // beyond what PRIMARY_ANGLE alone describes.
    const angles = seenAngles
      .map(a => a.length > 80 ? a.substring(0, 80) + '…' : a)
      .join(' | ');
    const postArguments = postSummary
      .filter(p => p.rationale)
      .map((p, i) => `Post ${i + 1} (${p.type}): ${p.rationale}`)
      .join('\n');
    const baseSummary = angles
      ? `Opslag planlagt på: ${actualScheduledDays}\n${summary}\nServiceperioder dækket af planlagte posts: ${angles}`
      : `Opslag planlagt på: ${actualScheduledDays}\n${summary}`;
    return postArguments
      ? `${baseSummary}\n\nPOST-ARGUMENTER (syntetisér bagud fra disse — lad dem forme hvad overview konkluderer om ugens samlede logik):\n${postArguments}`
      : baseSummary;
  })();

  const weekdayNames = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

  // ── Compact weather summary for narrative — full day-by-day only when relevant ──
  const weatherRelevance: 'low' | 'medium' | 'high' =
    (context as any).weather_relevance_for_business ?? 'medium';
  const weatherEffect: string =
    (context as any).weather_effect_on_visit_behavior ?? 'minimal';
  const weatherEffectOnDaypart: string =
    (context as any).weather_effect_on_daypart ?? 'minimal';

  // Derive short_effect description from interpretation data
  const effectDescMap: Record<string, string> = {
    indoor_refuge: 'dårligt vejr øger spontane indendørs besøg',
    terrace_pull:  'godvejr øger udeserveringsbrug og spontane besøg',
    takeaway_pull: 'vejret favoriserer takeaway frem for stedsbesøg',
    minimal:       'vejret påvirker ikke besøgsadfærd markant denne uge',
  };
  const shortEffect = (() => {
    const base = effectDescMap[weatherEffect] ?? effectDescMap.minimal;
    const pattern = context.weather.pattern;
    const temp = context.weather.avg_temp;
    return `${temp}°C, ${pattern} — ${base}`;
  })();

  // Best/worst day from day data
  const scoredDays = context.weather.days.map((d: any) => {
    const date = new Date(d.date);
    const name = weekdayNames[date.getDay()];
    const score = (d.temp_max ?? 0) + ((['sunny','partly_cloudy'].includes(d.condition)) ? 5 : 0)
      - ((d.precipitation_chance ?? 0) / 10);
    return { name, score, date: d.date };
  });
  const bestDay  = scoredDays.length > 0 ? scoredDays.reduce((a: any, b: any) => a.score > b.score ? a : b).name : '';
  const worstDay = scoredDays.length > 0 ? scoredDays.reduce((a: any, b: any) => a.score < b.score ? a : b).name : '';

  // Is business outdoor-led? (terrace-primary types get full day-by-day)
  const isOutdoorLed = context.weather.has_outdoor_seating &&
    (weatherEffect === 'terrace_pull' || weatherRelevance === 'high');

  // Count rainy days for explicit warning — prevents "Solrige dage" hallucination
  // NEW: Also detect weekday vs weekend contrast (e.g., rainy Mon-Thu, sunny Fri-Sat)
  const weekdayDays = (context.weather.days as any[]).filter((d: any) => {
    const dow = new Date(d.date).getDay();
    return dow >= 1 && dow <= 5; // Mon-Fri
  });
  const weekendDays = (context.weather.days as any[]).filter((d: any) => {
    const dow = new Date(d.date).getDay();
    return dow === 0 || dow === 6; // Sat-Sun
  });
  
  const rainyDayCount = (context.weather.days as any[]).filter((d: any) =>
    /rain|snow|fog|drizzle/i.test(d.condition || '') || (d.precipitation_chance ?? 0) >= 60
  ).length;
  const totalDayCount = (context.weather.days as any[]).length;
  
  const weekdayRainyCount = weekdayDays.filter((d: any) =>
    /rain|snow|fog|drizzle/i.test(d.condition || '') || (d.precipitation_chance ?? 0) >= 60
  ).length;
  const weekendRainyCount = weekendDays.filter((d: any) =>
    /rain|snow|fog|drizzle/i.test(d.condition || '') || (d.precipitation_chance ?? 0) >= 60
  ).length;
  
  // Check for weekday vs weekend contrast
  const hasWeekdayWeekendContrast = weekdayRainyCount >= 3 && weekendRainyCount === 0 && weekendDays.some((d: any) => d.temp_max >= 18);
  
  const rainyWeekWarning = rainyDayCount >= Math.ceil(totalDayCount / 2)
    ? hasWeekdayWeekendContrast
      ? `⚠️ VEJRKONTRAST: Regnfulde hverdage (${weekdayRainyCount}/${weekdayDays.length}) MEN pæn weekend. Du MÅ nævne "pæn weekend" eller "weekend-vejret" som fordel — men IKKE "hele ugen" eller "solrige dage". Vær præcis om hvornår vejret er godt.`
      : `⚠️ REGNUGE (${rainyDayCount}/${totalDayCount} dage): Skriv IKKE om sol, solrigt vejr, udendørs eller "solrige dage" i weather_season — det er faktuelt forkert.`
    : null;

  // Compact summary always injected
  const weatherCompact = [
    `relevans: ${weatherRelevance}`,
    `effekt: ${shortEffect}`,
    bestDay  ? `bedste dag: ${bestDay}`  : null,
    worstDay && worstDay !== bestDay ? `dårligste dag: ${worstDay}` : null,
    rainyWeekWarning,
  ].filter(Boolean).join(' | ');

  // Day-by-day: only for high relevance or outdoor-led businesses
  const weatherDayByDay = (weatherRelevance === 'high' || isOutdoorLed)
    ? context.weather.days.map((d: any) => {
        const date = new Date(d.date);
        const weekday = weekdayNames[date.getDay()];
        const tempRange = `${d.temp_min}-${d.temp_max}°C`;
        const condition = translateCondition(d.condition);
        const precipChance = d.precipitation_chance ? ` (${d.precipitation_chance}% regn)` : '';
        const hedge = d.reliability === 'cautious' ? ' ~usikker' : d.reliability === 'seasonal' ? ' ~sæson-estimat' : '';
        return `${weekday}: ${tempRange}, ${condition}${precipChance}${hedge}`;
      }).join(' | ') + '\n(~usikker = usikker prognose — ~sæson-estimat = historisk gennemsnit)'
    : null;

  const phase0Summary = phase0Analysis.key_factors.map((f: ContextFactor) =>
    `- ${f.icon || ''} ${f.name} (${f.type}, weight: ${f.strategic_weight})
  Impact: ${f.behavioral_impact}
  Målgruppe: ${f.target_audience}
  ${f.days_until !== undefined ? `Dage indtil: ${f.days_until}` : ''}
  ${f.timing_recommendation}`
  ).join('\n\n');

  // ── Brand voice extraction (mirrors phase2b approach) ─────────────────────
  const bv = context.brand_voice as any;
  
  const toneKeywords: string = (
    bv?.tone_model?.primary_keywords ||
    bv?.tone_keywords ||
    []
  ).slice(0, 5).join(', ') || '';

  const brandEssence: string = bv?.brand_essence || '';
  const brandEssenceElaboration: string = bv?.brand_essence_elaboration || '';

  // Writing rules from tone_of_voice field (may be a raw bullet string or structured object)
  const toneOfVoiceRaw: any = bv?.tone_of_voice;
  const writingRulesText: string = (() => {
    if (!toneOfVoiceRaw) return '';
    // Structured object from tone_model (e.g. {writing_rules: [...], ...})
    if (typeof toneOfVoiceRaw === 'object' && Array.isArray(toneOfVoiceRaw.writing_rules)) {
      return toneOfVoiceRaw.writing_rules.slice(0, 5).join('\n');
    }
    // Raw bullet string from brand profile generator (most common case)
    if (typeof toneOfVoiceRaw === 'string' && toneOfVoiceRaw.includes('-')) {
      return toneOfVoiceRaw.trim();
    }
    return '';
  })();

  // Business-specific do-not-say: from brand profile, not from a hardcoded list
  const neverSay: string[] = (bv?.never_say || []).slice(0, 6);
  const voiceConstraints: string = bv?.voice_constraints || neverSay.join(', ') || '';

  // Typical openings = concrete examples of how THIS business starts communication
  const typicalOpenings: string[] = (bv?.typical_openings || []).slice(0, 3);

  const humorLevel: string = bv?.humor_level || 'moderate';

  // Build the brand voice block dynamically — only include lines that have data
  const brandVoiceLines: string[] = [];
  if (brandEssence) brandVoiceLines.push(`Identitet: ${brandEssence}`);
  if (brandEssenceElaboration) brandVoiceLines.push(`Uddybning: ${brandEssenceElaboration}`);
  if (toneKeywords) brandVoiceLines.push(`Tone-nøgleord: ${toneKeywords}`);
  if (writingRulesText) brandVoiceLines.push(`Skrivestil (følg disse regler direkte):\n${writingRulesText}`);
  if (humorLevel) brandVoiceLines.push(`Humorgrad: ${humorLevel}`);
  if (typicalOpenings.length > 0) brandVoiceLines.push(
    `Eksempler på denne forretnings register og tone (vis SAMME register — genbrug ikke fraserne ordret):\n` +
    typicalOpenings.map(o => `  • "${o}"`).join('\n')
  );
  if (voiceConstraints) brandVoiceLines.push(`Undgå specifikt for denne forretning: ${voiceConstraints}`);

  const brandVoiceBlock = brandVoiceLines.length > 0
    ? `DENNE FORRETNINGS STEMME — GÆLDER KUN FOR POST-INDHOLD (ikke for din kommunikation til ejeren):\n${brandVoiceLines.join('\n')}`
    : `BRAND VOICE (KUN FOR POSTS): Brug en jordnær, autentisk dansk stemme der passer til stedet.`;
  // ─────────────────────────────────────────────────────────────────────────

  // ── Outdoor seating: weather-gated to prevent hallucination of opening decisions ──
  const anyDayOutdoorOk = context.weather.has_outdoor_seating &&
    context.weather.days.some((d: any) =>
      d.temp_max >= 14 && ['sunny', 'partly_cloudy'].includes(d.condition)
    );
  const outdoorSeatingLine = !context.weather.has_outdoor_seating
    ? ''
    : anyDayOutdoorOk
      ? `UDESERVERING: Tilgængelig — vejret er egnet mindst én dag denne uge (≥14°C og sol/let skyet)`
      : `UDESERVERING: Forretningen HAR udeservering — men vejret er IKKE egnet denne uge (ingen dage ≥14°C med sol). Nævn IKKE at udeserveringen åbner, aktiveres eller er i brug denne uge.`;

  // Location phrase rule — enforces the canonical local reference term
  const localRef = (context as any).location?.local_location_reference as string | null | undefined;
  const locationPhraseRule = localRef
    ? `⚠️ LOKATION: Brug ALTID "${localRef}" — ALDRIG generiske termer som "vandet", "ved vandet", "havnefronten", "waterfront", "området".`
    : '';
  // ─────────────────────────────────────────────────────────────────────────

  // ── Business concept block — encodes what the business IS beyond brand voice ──
  // These fields are in WeekContext but not part of brand_voice. Without them,
  // Phase 2c defaults to weather-led framing and misses the day-to-evening arc.
  const conceptLines: string[] = [];
  if (context.business_character) {
    conceptLines.push(`Forretningsbeskrivelse: ${context.business_character}`);
  }
  const menuProgrammes = (context as any).menu_programmes as Array<{ role: string; timeContext: string | null }> | null | undefined;
  if (menuProgrammes && menuProgrammes.length > 0) {
    conceptLines.push(`Serviceforløb: ${menuProgrammes.map(p => `${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}`).join(', ')}`);
  }
  if ((context as any).visit_mode) {
    const visitModeSentence: Record<string, string> = {
      destination: 'Gæster opsøger aktivt stedet — ikke walk-by eller impulskunder',
      convenience: 'Stedet tiltrækker primært spontane og gennemgående besøg',
      mixed:       'Gæster kombinerer planlagte destinationsbesøg og spontane drop-in',
    };
    const vmSentence = visitModeSentence[(context as any).visit_mode];
    if (vmSentence) conceptLines.push(vmSentence);
  }
  if ((context as any).primary_visit_motivation) {
    const motivationSentence: Record<string, string> = {
      social:    'Gæster bruger stedet primært til fællesspisning eller drinks i selskab (planlagte besøg)',
      meal:      'Gæster bruger stedet primært til planlagte måltider — besluttede besøg',
      pause:     'Gæster bruger stedet primært til kortere pauser fra arbejde, handel eller byaktivitet',
      treat:     'Gæster bruger stedet primært til særlige lejligheder eller forkælelsesbesøg',
      discovery: 'Gæster bruger stedet primært til opdagelse — nysgerrige besøgende, turister, første gangs-besøg',
    };
    const mvSentence = motivationSentence[(context as any).primary_visit_motivation];
    if (mvSentence) conceptLines.push(mvSentence);
  }
  if ((context as any).business_mode) {
    const businessModeSentence: Record<string, string> = {
      morning_cafe:          'Stedet fungerer som morgencafé — serverer om morgenen og lukker inden frokost',
      coffee_bar_takeaway:   'Stedet fungerer primært som kaffeudtag — take-away fokus, minimal bordservering',
      brunch_lunch_cafe:     'Stedet fungerer som brunch- og frokostcafé — åbner morgen og lukker midt på eftermiddagen',
      all_day_cafe:          'Stedet fungerer som heldagscafé — morgen til sen eftermiddag, intet aftenkøkken',
      lunch_restaurant:      'Stedet fungerer som frokostrestaurant — kun frokostservering',
      dinner_restaurant:     'Stedet fungerer som aftenrestaurant — kun aftenservering',
      evening_bar:           'Stedet fungerer som aftenbar — drinks og lettere mad fra aften og frem',
      hybrid_day_to_evening: 'Stedet fungerer fra dagsbesøg (kaffe og frokost) til aftenservering (mad og drinks) — se Serviceforløb ovenfor for det konkrete span',
    };
    const bmSentence = businessModeSentence[(context as any).business_mode] ?? (context as any).business_mode.replace(/_/g, ' ');
    if (bmSentence) conceptLines.push(bmSentence);
  }
  const conceptBlock = conceptLines.length > 0
    ? `VIRKSOMHEDSKONCEPT (støtte til formulering — bruges til konceptfit-beskrivelse, ikke til at genbestemme strategi):\n${conceptLines.map(l => `- ${l}`).join('\n')}`
    : '';
  // ─────────────────────────────────────────────────────────────────────────

  // ── CRITICAL OUTDOOR TERMINOLOGY CONSTRAINT ──
  const outdoorTerminologyBlock = `⚠️ UDENDØRS TERMINOLOGI (gælder ALLE felter — uanset vejr):
FORBUDTE specifikke stedtermer: "terrasse", "terrassevejr", "gårdhave", "gård", "haven", "altanen", "udearealet", "udepladsen", "udeområdet"
TILLADTE generiske termer: "indendørs" / "udendørs" (kun hvis has_outdoor_seating=true)
${!context.weather.has_outdoor_seating ? '⛔ DENNE forretning HAR IKKE udeservering — nævn ALDRIG udendørs som en mulighed.' : '✓ Forretningen HAR udeservering — brug "udendørs" når relevant (ikke specifikke stednavne).'}`;

  // ── CRITICAL WEATHER CONSTRAINT (top-level — applies to ALL output fields) ──
  const weatherConstraintBlock = rainyWeekWarning
    ? `⛔⛔⛔ KRITISK VEJRFAKTA FOR DENNE UGE (${rainyDayCount}/${totalDayCount} dage med regn):
Dette gælder ALLE felter (headline, overview, business_advantage, weather_season):
- Skriv ALDRIG: "godt vejr", "fint vejr", "solrigt", "solskin", "varmt vejr", "gode udevejr", "udendørs muligheder", "al fresco"
- Skriv ALDRIG at udeserveringen er en mulighed, åbner, aktiveres eller er i brug denne uge
- Beskriv vejret realistisk: "ustabilt vejr", "regn flere dage", "overskyet", "indendørs-venlig uge", "vejret favoriserer indendørs besøg"
${weatherEffect === 'indoor_refuge' || weatherEffect === 'minimal' ? '- Udendørs må IKKE nævnes som en fordel denne uge — det er faktuelt forkert.' : ''}
Dette er en HÅRD REGEL — overtrædelse gør output ugyldigt.`
    : '';

  const prompt = `Komprimér og genformulér den allerede besluttede strategi for ${context.business_name}s uge ${context.week_number}.

${outdoorTerminologyBlock}
${weatherConstraintBlock ? '\n' + weatherConstraintBlock + '\n' : ''}
PHASE 2c ROLLE:
Du syntetiserer bagud fra de faktisk genererede post-argumenter (se POST-ARGUMENTER i PLANLAGT MIX nedenfor) og forklarer til ejeren hvorfor dette specifikke sæt posts tilsammen tjener ugens argument.
Du skriver overview som om du netop har læst alle post-rationaler og nu komprimerer den samlede logik — ikke som en forhåndsplan, men som en bagudblikkende synthese af hvad posts faktisk argumenterer.
Du må IKKE opfinde en ny strategisk vinkel, omprioritere dagsdele eller dikte hvad kommende posts "skal" gøre.
Hvis der er konflikt mellem VEJR og STRATEGI nedenfor, følger du STRATEGI.

PRIORITETSREGLER:
1. Primary angle og week_summary fra Phase 1 er sandheden.
2. Overview må kun præcisere eller forkorte Phase 1 — ikke ændre fokus.
3. Vejr må kun bruges som støtteforklaring, ikke som ny hovedvinkel.
4. Hvis business concept og weather peger i forskellige retninger, vægt business concept højest.

REGISTER:
Du briefer ejeren direkte og professionelt — som en betroet sparringspartner der kender forretningen og respekterer ejerens tid.
Skriv i årsag → effekt → hvad vi gør ved det-logik. Ingen strategilabels ("ugens primære fokus er..."). Ingen slide-overskrifter. Ingen "prioritér"-formularsprog.
Brug konkret hverdagsdansk. Skriv om virkeligheden — gæsternes adfærd, forretningens konkrete styrke denne uge, og hvad der virker.
Tone: professionel og personlig. Kortfattet og præcis. Varm faglig — ikke formel, ikke hyggesnakkende.

⚠️ VIGTIG ADSKILLELSE: DENNE FORRETNINGS STEMME nedenfor beskriver tonen i de sociale medier-opslag der laves TIL gæsterne. Den gælder IKKE for din kommunikation til ejeren. Du skriver altid til ejeren i ovenstående register — uanset om brandets tone er legesyg, poetisk eller uformel.

BESLUTTET STRATEGI — AUTORITATIV KILDE (må IKKE omfortolkes):

WEEK_SUMMARY (sandheden om denne uge — headlines og overview skal komprimere dette):
${weekSummaryText}

PRIMARY_ANGLE (den dominerende strategiske akt — bestemmer headline og overview-fokus):
${primaryAngleSummary}

COMPETITIVE_ADVANTAGE (hvad adskiller NETOP denne forretning — brug dette i business_advantage):
${competitiveAdvText}

STØTTEAKTER (bruges til timing og indholdsvariation — må IKKE erstatte primary_angle):
${supportAnglesSummary || 'Ingen yderligere støtteakter'}

${brandVoiceBlock}

${conceptBlock ? conceptBlock + '\n\n' : ''}SPECIFIKHEDS-TEST (anvend på hvert output-felt): Kan det passe på 20 andre ${context.business_type}-forretninger i ${context.city}? Hvis ja, er det UGYLDIGT — brug et konkret udtryk fra Forretningsbeskrivelse eller Identitet ovenfor.
  overview SKAL nævne mindst 2 af disse 4 konkrete elementer:
    1. Konkret dagsdels-span (eks. "kl. 11–15", "fra brunch til aftenservering", "morgen til sen eftermiddag")
    2. Konkret besøgsmotivation (eks. "planlagte frokostbesøg", "social aftenmad", "spontan kaffepause")
    3. Konkret driftsprogram (eks. "brunch og frokost-menu", "to-retters aftensmenu", "dagsservering og aftenkøkken")
    4. Konkret lokationsfunktion som valg-argument (beskriv konkret hvad placeringen giver gæsten frem for anonymt alternativ — undgå den generiske frase "et aktivt valg")
  Tæl de 4 elementer. Har du mindst 2? Ellers er den ugyldig. Brug naturligt dansk. Undgå svenske/norske ord (fika, koselig, lagom).

KALIBRERINGS-EKSEMPEL — overview-felt:
  ✗ "Regn og køligt vejr skubber gæster indendørs. [Forretningsnavn] er et oplagt valg til en god oplevelse." — vejr som åbner, intet konkret om forretningen.
  ✓ "[Forretningsnavn] serverer [driftsform] [dagsdel + tidspunkt]. [Besøgstype specifik for stedet — IKKE 'et aktivt valg']. [Lokationsargument som valg-begrundelse]. Lad opslagene [tidsrum] gøre [gæstens næste skridt] let."
Reglen: Åbn med det der definerer NETOP denne forretning NETOP denne uge — komprimér PRIMARY_ANGLE og WEEK_SUMMARY direkte. Vejr åbner KUN første sætning hvis vejret er det dominerende signal.

KONTEKST (baggrund — bruges til formulering, ikke til at genbestemme strategi):
${(() => {
  const items = (context as any).signature_items as Array<{ name: string }> | undefined;
  if (!items || items.length === 0) return 'Ingen menuliste tilgængelig — nævn INGEN specifikke retter.';
  return `VERIFICERET MENULISTE (brug KUN navne herfra): ${items.map((i: { name: string }) => i.name).join(', ')}`;
})()}${(() => {
  const pws = (context.previous_week as any).past_week_summaries as Array<{ week_number: number; week_summary: string; overview: string }> | undefined;
  if (!pws || pws.length === 0) return '';
  const overviewEntries = pws.filter(s => s.overview).map(s => `Uge ${s.week_number}: "${s.overview}"`);
  if (overviewEntries.length === 0) return '';
  return `\nFORRIGE UGERS OVERVIEW (til reference — disse tekster er allerede sendt til ejeren):\n${overviewEntries.join('\n')}`;
})()}

PLANLAGT MIX (type- og timingfordeling — titler er skjult):
${plannedMixSummary}

DAG-SPECIFICITETS-REGEL (kritisk): "Opslag planlagt på:"-linjen ovenfor er den autoritative liste over dage med faktiske opslag. Nævn INGEN specifikke ugedage (tirsdag, onsdag, torsdag osv.) i overview eller timing_context medmindre de fremgår af den liste. Skriv fx IKKE "tirsdag til torsdag" som om der er posts planlagt der, hvis listen ikke inkluderer disse dage.

VEJR (støtteforklaring — brug kun til at forklare adfærd, IKKE til at sætte ny hovedvinkel):
  ${weatherCompact}${weatherDayByDay ? '\n  Dag-for-dag: ' + weatherDayByDay : ''}
SÆSON (støtteforklaring): ${context.season.current}
ØKONOMI (støtteforklaring): Uge ${context.economic.week_of_month}/4 i måneden (${translateEconomicPattern(context.economic.pattern)})
${context.events.length > 0 ? `EVENTS (støtteforklaring): ${context.events.map(e => { const label = (e as any).name_dk || e.name; return (e as any).in_week === false ? `${label} (næste uge — ikke i denne uges dage)` : label; }).join(', ')}` : 'EVENTS: Ingen'}
${outdoorSeatingLine}${locationPhraseRule ? '\n' + locationPhraseRule : ''}
⚠️ SPROGKRAV: Skriv KUN på dansk. Kildematerialet (BESLUTTET STRATEGI ovenfor) kan indeholde engelske labels som "Terrace Pull", "Destination Visit", "Outdoor Opportunity" o.l. — disse må ALDRIG citeres eller parafraseres i dit output. Oversæt dem til konkret dansk: "destinationsbesøg ved åen", "besøg planlagt som udflugtssted" osv.
FORBUDTE ORD — uanset sammenhæng: "al fresco" (italiensk restaurantjargon — brug "udendørsspisning" eller "udeservering") · "hygge" (som et-ords-reklame uden konkret indhold) · "fika" (svensk) · "koselig" (norsk). Brug naturlig hverdagsdansk.

REGLER:
1. headline: "Uge ${context.week_number}: [tema]" — max 8 ord.
   PRIMARY_ANGLE LABEL (brug dette som udgangspunkt — du MÅ IKKE skifte tema): "${primaryAngleLabel}"
   Headline er en KONDENSERET VERSION af primary_angle-labelen ovenfor — komprimér og formulér den konkret, men skift IKKE tema.
   Vejr, location og events må KUN refinere formuleringen hvis de forstærker primary_angle direkte — de må ALDRIG erstatte det.${rainyWeekWarning ? '\n   ⛔ VEJRPROHIBITION: Nævn ALDRIG "terrassevejr", "udevejr", "udendørs", "solrigt" i headline. Det er faktuelt forkert denne uge.' : ''}
   FORBUDT: ny vinkel der ikke fremgår af primary_angle · lokation som suffix ("...ved åen", "...ved havnen") · vejr som stemning ("i køligt vejr", "i vintervejr") · generiske løfter.
   HEADLINE AFVISNINGSREGLER (kontrollér inden du afslutter — afvis og skriv om hvis én gælder):
     ✗ Headline starter med: "Indendørs", "Udendørs", "Vejr", "Regn", "Sæson", "Koldt", "Varmt" — disse er vejr/kontekstord, ikke forretningsidentitet     ✗ Headline indeholder ordet "indendørs" eller "udendørs" NOGEN steder — disse er vejreffekt-ord, ikke forretningsidentitet${rainyWeekWarning ? '\n     ✗ Headline nævner terrassevejr, udevejr eller udendørs muligheder — det er faktuelt forkert denne uge' : ''}
     ✗ Headline indeholder ikke mindst ét forretningsspecifikt anker fra PRIMARY_ANGLE, Identitet eller Serviceforløb
     ✗ Headline kunne passe på enhver café/restaurant i ${context.city} uden ændringer — tilføj det konkrete element der adskiller NETOP denne forretning
2. overview: 3 bullet-punkter direkte til ejeren — et 4. bullet er tilladt hvis sætning 3 ellers skal udføre to adskilte jobs (fx taktik + sekundær dagsdel eller event).
   Hvert bullet starter med "• " og indeholder præcis én sætning. Ingen prosa-blok — brug linjeskift (\n) mellem hvert bullet.${rainyWeekWarning ? '\n   ⛔ VEJRPROHIBITION FOR DENNE UGE: Nævn ALDRIG "godt terrassevejr", "fint udevejr", "udendørs muligheder" eller at udeservering er aktiv. Det er faktuelt forkert.' : ''}
   STANDARD PRIORITET:
   Sætning 1: TRIGGER — den konkrete mekanisme eller det ugssignal der gør retningen indlysende.
     Skriv en observation om verden eller gæsternes adfærd: "Sidst på ugen planlægger folk i højere grad at spise ude ordentligt", "Midt i måneden er det spontane besøg det normale mønster".
     MÅ IKKE starte med et strategilabel: ALDRIG "[X] er ugens primære fokus", ALDRIG "Ugens fokus er...", ALDRIG "Primært fokus..."
     FORBUDT vejrklichéer: "skubber gæsterne indendørs", "skubber indendørs", "trækker gæsterne indendørs", "trækker indendørs", "vejret gør stedet attraktivt", "vejret indbyder", "søger indendørs alternativer"${rainyWeekWarning ? ', "godt terrassevejr", "fint udevejr", "udendørs muligheder"' : ''}
   Sætning 2: DIFFERENTIERING — hvad KUN denne forretning kan tilbyde, ikke blot hvad der passer til anledningen.
     Frem for "vi matcher de planlagte besøg": beskriv den specifikke kombination — hvad ejeren har, som gæsten ikke finder det anonyme alternativ samme sted.
     SKAL bygges af mindst 2 af disse 4 elementer:
       a) Dagsdels-span med klokkeslet eller dagsnavn: eks. "brunch til aftenservering kl. 9–22" · "frokostprimær hverdagssted kl. 11–15"
       b) Konkret besøgstype: eks. "planlagte destinationsbesøg med bordbestilling" · "spontane frokostpauser tirsdag–torsdag"
       c) Driftsargument: eks. "skiftende to-retters frokostmenu" · "aftensmenu med vinmenu og bordservering"
       d) Lokationsargument som valg-begrundelse: eks. "placeringen giver møde- og destinationsargument frem for anonymt alternativ"
     BLOKEREDE FRASER I SÆTNING 2 (brug = automatisk afvisning): "samlet oplevelse" · "oplagt valg" · "søger mere end" · "noget særligt" · "mere end bare" · "giver en oplevelse" · "et aktivt sted" · "matcher netop"
     TEST sætning 2: Ville man skrive det samme om en anden forretning i ${context.city}? Hvis ja, skriv om — tilføj det konkrete der kun gælder denne forretning.
   Sætning 3: GÆSTENS NÆSTE SKRIDT — hvad opslagene skal gøre let for gæsten, ikke hvad ejeren skal "prioritere".
     FORBUDT: "prioritér derfor...", "fokusér på...", "sørg for...", "skal vi..." — disse er interne instruktioner, ikke briefing-sprog.
     Skriv i stedet hvad gæsten skal have det let at gøre: "Lad opslagene [dag–dag] gøre [X] let — vis [Y] tydeligt og giv [Z]."
   Sætning 4 (tilladt, ikke påkrævet): Brug kun hvis der er en sekundær dagsdel, et event eller et taktisk spor der ikke kan rummes i S3 uden at S3 bliver overbelastet.
     Skriv aldrig S4 som en gentagelse af S3 i anden ordlyd. Tilføjes KUN hvis den tilfører ny information. MÅ IKKE starte med "Samtiidg skal vi", "Vi skal", "Vi bør" — hold 3. person eller gæste-framing.
   PERSPEKTIV-REGEL (gælder hele overview): Skriv OM forretningen til ejeren — ikke SOM forretningen.
     FORBUDT første-person: "vi/vores/os" — overview er en briefing, ikke en selvistelses-tekst.
     Brug i stedet: "[Forretningsnavn]", "stedet", "køkkenet", "aftens menuen" eller passiv konstruktion.
   FLER-DAGDELS-REGEL: Når PLANLAGT MIX nedenfor viser serviceperioder ud over PRIMARY_ANGLE (fx aften-posts når primary_angle handler om frokost, eller brunch-posts ved siden af aftenservering), SKAL overview anerkende den fulde ugsdækning — nev n de sekundære dagsdele i S3 eller S4: "[primær dagsdel] får flest posts, men mix dækker også [sekundær dagsdel] [dag(e)]."
     MÅ IKKE: lade overview give det samlede indtryk at ugen kun handler om én dagsdel, når post-mix dækker to eller flere.
   FORBUDT i hele overview: vage retningsangivelser uden tal eller operationel detalje
3. weather_season: Beskriv vejret og sæsonen, forklar hvad det betyder for gæsternes adfærd. Brug "Uge ${context.week_number}" i starten.
   ⚠️ INGREDIENS-REGEL: Nævn ALDRIG specifikke retter, ingredienser eller madvarer i weather_season — hverken sæsonvarer (forårsløg, spinat, asparges, osv.) eller menuretter. Beskriv KUN vejr + gæste-adfærd.
   ${rainyWeekWarning || ''}
   📍 VEJR-PRÆCISION: Brug dag-for-dag detaljer fra VEJR-FORTOLKNING øverst. Hvis der er kontrast mellem hverdage og weekend (fx regnfulde hverdage, pæn weekend), beskriv det præcist — undgå generiske udsagn om "hele ugen".
4. timing_context: Beskriv GÆSTE-ADFÆRD og HANDLEMØNSTRE, ikke generiske stemningsbeskrivelser:
   Økonomisk timing: Konkret adfærd ("folk overvejer mere hvad de bruger" — ikke "stramt budget")
   Events: Konkrete forventninger og handlinger (booking-adfærd, besøgsmønster)
   Hvis ingen events: fokusér på ugespecifik adfærd (hverdagsrytme, frokostpause-mønstre)
5. business_advantage: Svar på "Hvorfor NETOP denne forretning — ikke bare en forretning som denne — denne uge?"${rainyWeekWarning && !hasWeekdayWeekendContrast ? '\n   ⛔ VEJRPROHIBITION: Nævn ALDRIG udeservering eller udendørs fordele som en styrke denne uge — det er faktuelt forkert når vejret ikke kvalificerer.' : hasWeekdayWeekendContrast ? '\n   ✅ WEEKEND-UDESERVERING: Du MÅ nævne udeservering som fordel HVIS du begrænser det til weekend (fx "weekend-terassen" eller "lørdag-søndag udeservering") — men IKKE som en hel-uges fordel.' : ''}
   KRÆVER mindst to af disse dimensioner:
     a) Lokal/geografisk fordel — beskriv som aktivt valg-argument, IKKE visuel baggrund: "placeringen ved X giver et møde- og destinationsargument" / "beliggenheden gør stedet til et aktivt valg frem for anonymt alternativ"
     b) Dagsdels- eller menukortfordel (hvad vi har der matcher ugens adfærd)
     c) Driftsmodelfordel (åbningstider, kapacitet, service-format)
     d) Besøgsmotivationsfit (hvad driver gæster hertil netop denne uge)
   FORBUDT som standalone: "kvalitet", "autentisk", "lokal", "hyggelig" — medmindre bundet til et konkret faktum.
   UGYLDIG hvis business_advantage KUN bygger på ét eller flere af disse uden yderligere konkret indhold:
     - vejr alene (eks. "vejret gør stedet attraktivt")
     - beliggenhed alene uden valg-argumentation (eks. "centralt beliggende", "tæt på")
     - "god oplevelse" eller "kvalitetsoplevelse" uden konkret begrundelse
     - "kvalitet" som ubegrundet standalone-påstand
     - "hyggelig stemning" eller atmosfære-metaforer${rainyWeekWarning ? '\n     - udeservering eller udendørs fordele (faktuelt forkert denne uge)' : ''}
   Test: Kan business_advantage stå alene som svar på "Hvorfor ikke bare en anden forretning i samme gade?" — hvis nej, skriv om.
6. post_plan: Beskriv det overordnede mix i 1-2 sætninger — eks. "3 menu-posts med brunch-fokus + 1 bag-om-post". Brug PLANLAGT MIX ovenfor som reference — ikke til at skrive om strategien, kun for at validere mixet.

7. anti_repetition: Gælder kun hvis FORRIGE UGERS OVERVIEW er udfyldt ovenfor. Ingen sætning i overview eller business_advantage må ligne en sætning fra de viste uger nøje nok til, at ejeren ville sige "det sagde du også forrige uge". Parafrasering tæller som gentagelse. Du MÅ bruge de samme forretningsspecifikke fakta (åbningstider, dagsdel-span) — MEN formuleringen og den konkret fremhævede uge-observation SKAL adskille sig.
IDENTITETS-REGEL: Nævn kun forretningsmodellen eller brand-essensen i overview/business_advantage hvis den direkte forklarer DENNE uges kommercielle prioritet. Undgå boilerplate-identitetssætninger af typen "[Navn] er [generisk beskrivelse] — det gør stedet til [generisk løfte]".

8. continuation_note: Gælder KUN hvis FORRIGE UGERS OVERVIEW er udfyldt ovenfor.
   Skriv 1-2 sætninger der forklarer ejeren hvad der er anderledes denne uge sammenlignet med forrige.
   Eksempel: "Sidste uge lå tyngden på spontane hverdagsfrokoster — denne uge rykker vi fokus mod weekendens aftengæster da vejret og lønningsdag understøtter det."
   Vær konkret: nævn hvad der var den dominerende vinkel sidste uge (fra FORRIGE UGERS OVERVIEW), og hvad der er anderledes eller skiftet denne uge. Brug ejernes eget hverdagssprog — ingen strategilabels.
   Hvis der ikke er nogen FORRIGE UGERS OVERVIEW: sæt feltet til null.

Svar KUN med JSON:
{
  "headline": "Uge ${context.week_number}: [kondenseret version af '${primaryAngleLabel}' — ikke et nyt tema, ikke lokation som suffix]",
  "overview": "• [S1: konkret trigger/mekanisme der gør ugens retning indlysende — ALDRIG et strategilabel]\n• [S2: hvad KUN denne forretning kan — ikke 'matcher', men konkret kombination der adskiller den]\n• [S3: hvad opslagene skal gøre let for gæsten — ikke 'prioritér', men gæstens næste skridt]\n• [S4 valgfri: kun hvis sekundær dagsdel/event ikke kan rummes i S3]",
  "continuation_note": "[1-2 sætninger: hvad var sidste uges dominerende vinkel, hvad er ændret denne uge — eller null hvis ingen sidste uge-data]",
  "detailed_sections": {
    "weather_season": "Vejr + gæste-adfærd (3-4 sætninger) — INGEN ingredienser/retter, INGEN hygge-ord",
    "timing_context": "Gæste-handlemønster + events + ugespecifik adfærd (3-4 sætninger) — konkret, ikke stemnings-baseret",
    "business_advantage": "Mindst 2 af 4 dimensioner: lokal fordel som valg-argument, menukortfit, driftsfordel, besøgsmotivationsfit — UGYLDIG hvis KUN vejr/beliggenhed-alene/god oplevelse/kvalitet/hyggelig stemning — test: kan dette stå som svar på 'hvorfor ikke bare naboen?'",
    "post_plan": "1-2 sætninger om overordnet mix — eks. '3 brunch-posts + 1 bag-om-post'. IKKE individuelle titler."
  }
}`;

  const result = await callGeminiWithRetry(
    prompt,
    {
      temperature: 0.3,
      maxOutputTokens: 3072,
      jsonMode: true,
      model: 'gemini-2.5-flash',
    },
    'Phase 2c'
  );

  console.log(`[Phase 2c] Completed in ${Math.round(performance.now() - t0)}ms`);

  // Silent spelling correction on narrative (parallel)
  const narrative = result.parsed;

  try {
    const correctionPromises: Promise<string>[] = [];
    const correctionKeys: string[] = [];

    // headline is skipped: it's locked to primaryAngleLabel and must not be rephrased
    if (narrative.overview && typeof narrative.overview === 'string') {
      correctionPromises.push(silentSpellingCorrection(narrative.overview, 'da'));
      correctionKeys.push('overview');
    }
    if (narrative.detailed_sections && typeof narrative.detailed_sections === 'object') {
      if (narrative.detailed_sections.weather_season) {
        correctionPromises.push(silentSpellingCorrection(narrative.detailed_sections.weather_season, 'da'));
        correctionKeys.push('weather_season');
      }
      if (narrative.detailed_sections.timing_context) {
        correctionPromises.push(silentSpellingCorrection(narrative.detailed_sections.timing_context, 'da'));
        correctionKeys.push('timing_context');
      }
      if (narrative.detailed_sections.business_advantage) {
        correctionPromises.push(silentSpellingCorrection(narrative.detailed_sections.business_advantage, 'da'));
        correctionKeys.push('business_advantage');
      }
      if (narrative.detailed_sections.post_plan) {
        correctionPromises.push(silentSpellingCorrection(narrative.detailed_sections.post_plan, 'da'));
        correctionKeys.push('post_plan');
      }
    }

    const correctedValues = await Promise.all(correctionPromises);

    correctedValues.forEach((value, index) => {
      const key = correctionKeys[index];
      if (key === 'headline') {
        narrative.headline = value;
      } else if (key === 'overview') {
        narrative.overview = value;
      } else if (narrative.detailed_sections) {
        narrative.detailed_sections[key] = value;
      }
    });

    console.log(`[Phase 2c] ${correctionPromises.length} spelling corrections applied in parallel`);
  } catch (spellingError) {
    console.warn('[Phase 2c] Spelling correction failed for narrative:', spellingError);
  }

  // ── Grammar + quality sanity pass → Phase 1 fallback ────────────────────────
  // Pass 1: check first-run output.
  // Pass 2 (rerun): if Pass 1 failed, rerun Phase 2c once and re-check.
  // Phase 1 fallback: if Pass 2 also fails or throws, derive directly from
  //   strategicBrief — no further AI calls, no repeated prompt iteration:
  //   - headline = "Uge X: <primaryAngleLabel>"  (Phase 1 primary_angle.focus)
  //   - overview = first 3 sentences of weekSummaryText (Phase 1 week_summary)
  {
    const HEADLINE_BANNED_STARTS = ['indendørs', 'udendørs', 'vejr', 'regn', 'sæson', 'koldt', 'varmt'];
    // Also catch 'indendørs'/'udendørs' appearing ANYWHERE in the headline body
    const headlineContainsBannedWord = (body: string) =>
      HEADLINE_BANNED_STARTS.some(w => body.startsWith(w)) ||
      /\bindendørs\b|\budendørs\b/i.test(body);
    const BLOCKED_OVERVIEW_PHRASES = ['samlet oplevelse', 'oplagt valg', 'søger mere end', 'noget særligt', 'mere end bare', 'giver en oplevelse', 'matcher netop', 'prioritér derfor', 'ugens primære fokus', 'primært fokus', 'i baggrunden', 'som baggrund', 'som backdrop', 'skubber gæsterne ind', 'skubber ind', 'trækker gæsterne ind', 'skal vi gøre'];
    
    // Forbidden specific outdoor location terms — always prohibited regardless of weather
    const FORBIDDEN_OUTDOOR_TERMS = ['terrasse', 'terrassevejr', 'gårdhave', 'gården', 'haven', 'altanen', 'udearealet', 'udepladsen', 'udeområdet'];
    
    // Rainy week hallucination phrases — forbidden when rainyWeekWarning is active
    const RAINY_WEEK_HALLUCINATIONS = rainyWeekWarning 
      ? ['godt vejr', 'fint vejr', 'solrigt', 'solskin', 'varmt vejr', 'sommervejr', 'varme aftener', 'varme sommeraftener', 'lune aftener', 'lune sommeraftener', 'udendørs muligheder', 'udendørs servering', 'udeservering', 'udeservering åbner', 'udeservering aktiveres', 'åben udeservering', 'al fresco', 'lokker gæster til udendørs', 'lokker til udendørs']
      : [];
    
    // Catches both classic "er/var et Xte" and "til et Xte" (e.g. "gør stedet til et planlagte besøg")
    const brokenAgreementRx = /\b(?:er|var|til|som)\s+(?:et|en)\s+[a-zæøå]+te\b/i;

    const checkQuality = (headline: string, overview: string, businessAdvantage?: string) => {
      const body = (headline || '').replace(/^Uge \d+:\s*/i, '').toLowerCase();
      const headlineBanned = headlineContainsBannedWord(body);
      const grammarFail  = brokenAgreementRx.test(overview || '');
      const phraseFail   = BLOCKED_OVERVIEW_PHRASES.some(p => (overview || '').toLowerCase().includes(p));
      
      // Check for weather hallucinations across headline, overview, and business_advantage
      const allText = `${headline || ''} ${overview || ''} ${businessAdvantage || ''}`.toLowerCase();
      // Check for forbidden specific outdoor terms (always prohibited)
      const forbiddenOutdoorTermFail = FORBIDDEN_OUTDOOR_TERMS.some(term => allText.includes(term.toLowerCase()));
      const weatherHallucinationFail = RAINY_WEEK_HALLUCINATIONS.some(phrase => allText.includes(phrase.toLowerCase()));
      
      return { 
        headlineBanned, 
        grammarFail, 
        phraseFail, 
        weatherHallucinationFail,
        forbiddenOutdoorTermFail,
        anyFail: headlineBanned || grammarFail || phraseFail || weatherHallucinationFail || forbiddenOutdoorTermFail
      };
    };

    // Phase 1 fallback: built directly from strategic brief data — no AI call
    const applyPhase1Fallback = (reason: string) => {
      narrative.headline = `Uge ${context.week_number}: ${primaryAngleLabel}`;
      // Use Phase 1 week_summary as overview: first 3 sentences, max 300 chars
      const raw = weekSummaryText.trim();
      const sentences = raw.split(/(?<=[.!?])\s+/);
      narrative.overview = sentences.slice(0, 3).join(' ') || raw.substring(0, 300);
      console.warn(`[Phase 2c] Phase 1 fallback applied (${reason}):`, {
        headline: narrative.headline,
        overviewLength: narrative.overview.length,
      });
    };

    const businessAdv = narrative?.detailed_sections?.business_advantage || '';
    const pass1 = checkQuality(narrative.headline || '', narrative.overview || '', businessAdv);
        
    if (pass1.anyFail) {
      console.warn('[Phase 2c] Pass 1 quality check failed — retrying:', {
        headlineBanned: pass1.headlineBanned,
        grammarFail:    pass1.grammarFail,
        phraseFail:     pass1.phraseFail,
        weatherHallucinationFail: pass1.weatherHallucinationFail,
        forbiddenOutdoorTermFail: pass1.forbiddenOutdoorTermFail,
        headline:       (narrative.headline || '').substring(0, 80),
      });
      try {
        const retryResult = await callGeminiWithRetry(
          prompt,
          { temperature: 0.3, maxOutputTokens: 3072, jsonMode: true, model: 'gemini-2.5-flash' },
          'Phase 2c'
        );
        const retried = retryResult?.parsed;
        if (!retried) {
          applyPhase1Fallback('rerun returned no parsed output');
        } else {
          const retriedBusinessAdv = retried?.detailed_sections?.business_advantage || '';
          const pass2 = checkQuality(retried.headline || '', retried.overview || '', retriedBusinessAdv);
          if (pass2.anyFail) {
            // Rerun also failed — use Phase 1 data for headline + overview
            applyPhase1Fallback('rerun still failed checks');
            // Rerun's detailed_sections may still be better than the first run's
            if (retried.detailed_sections) narrative.detailed_sections = retried.detailed_sections;
          } else {
            // Rerun passed — accept it in full
            narrative.headline = retried.headline;
            narrative.overview = retried.overview;
            if (retried.detailed_sections) narrative.detailed_sections = retried.detailed_sections;
            console.log('[Phase 2c] Pass 2 rerun passed quality check — using retried output');
          }
        }
      } catch (retryErr) {
        console.error('[Phase 2c] Rerun threw — applying Phase 1 fallback:', retryErr);
        applyPhase1Fallback('rerun threw exception');
      }
    }
  }

  return narrative;
}
