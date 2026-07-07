/**
 * Danish Field-Specific Output Instructions for Brand Profile Generation (Prompt B)
 * 
 * This file contains detailed instructions for how to generate each output field.
 * These are builder functions that accept business-specific parameters to generate
 * contextually appropriate instructions.
 * 
 * MIGRATION: Extracted from hardcoded prompt-b.ts to enable:
 * - Parameter-driven instruction generation
 * - Business-type-specific guidance
 * - Easier maintenance and testing
 * - Better proximity between related instructions (rules + examples close together)
 * 
 * Date: 2026-05-12
 * Part of: Brand Profile Prompt Refactoring Phase 1
 */

export interface FieldInstructionParams {
  confirmedProgrammeSlots?: string[]
  languageName: string
}

/**
 * Builds voice_rationale field instructions (Field 0)
 */
export function buildVoiceRationaleInstructions(): string {
  return `0) voice_rationale — ⚠️ OBLIGATORISK — SKRIV DETTE FØR tone_of_voice
   KRAV: 3–6 sætninger i naturligt dansk, som forklarer HVORDAN du kom frem til stemme-reglerne.
   
   STRUKTUR (3 dele — alle obligatoriske):
   1️⃣ DATAKILDER (hvad havde du at arbejde med?):
      - Nævn konkrete kilder: menu AI summaries (X programme), åbningstider (fra X til Y), location intelligence (area_type: vandfront/bymidte), website (ja/nej — hvis ja, hvor mange tekstblokke?), operational features (har_udendørs_servering, has_kids_menu osv.)
      - Eksempel: "Datagrundlaget består af 4 menu-programmer (BRUNCH, FROKOST, AFTEN, COCKTAILS), åbningstider 09:30-02:00 (weekend), samt location intelligence der bekræfter vandfront-beliggenhed ved åen."
   
   2️⃣ TEKSTKVALITET (observeret vs. udledt):
      - PATH A (website med ≥50 ord prose): "Hjemmesiden bruger X ordvalg / Y rytme / Z sætningsstruktur — disse mønstre er direkte observerbare."
      - PATH B (ingen tekst): "Da hjemmesiden har begrænset tekstindhold, er stemme-reglerne udledt fra situationelle signaler: [nævn 2-3 konkrete signaler som BRUNCH-program kl. 09:00, vandfront-lokation, kids_menu]."
   
   3️⃣ KONKLUSION (observed vs. assessed):
      - PATH A: "Stemme-reglerne er observeret fra stedets egen kommunikation."
      - PATH B: "Stemme-reglerne er vurderet ud fra stedets koncept og målgruppesignaler — ikke fra direkte tekstprøver."
   
   ✅ KONKRET EKSEMPEL (PATH B — ingen website text):
  "Datagrundlaget består af 5 menu-programmer (BRUNCH, FROKOST, AFTEN, COCKTAILS, BØRNEMENU), åbningstider 09:30-02:00 (weekend bekræfter senprogrammer), samt location intelligence (vandfront ved åen, bymidte-sekundær, tourist context). Da hjemmesiden har begrænset tekstindhold, er stemme-reglerne udledt fra multi-program karakteren (morgen til nat), vandfront-specificiteten, og familievenlige features (børnemenu, udeservering). Stemme-reglerne er derfor vurderet ud fra stedets koncept — ikke fra direkte tekstprøver."
   
   ❌ FORBUDT: Tom streng, generiske udsagn uden konkrete signaler, kopiering af instruktioner
   ⚠️ VALIDATION: Dette felt SKAL være udfyldt. Tom streng = hard error.`
}

/**
 * Builds business_character field instructions (Field 1)
 */
export function buildBusinessCharacterInstructions(): string {
  return `1) business_character — ⚠️ OBLIGATORISK
   KRAV: 1–2 sætninger som beskriver hvad denne forretning FAKTISK ER.
   
   INDHOLD (alle obligatoriske):
   - Hvis hybrid (café + restaurant + bar): Nævn ALLE roller eksplicit: 'Café, restaurant og bar...'
   - Fysiske features som skaber indholdsmu ligheder: 'med udendørs terrasse', 'med havudsigt', 'i en gammel fabrikshal'
   - Tidsmæssige formater eller skift hvis relevant: 'serverer kaffe om dagen og skifter til drinks om aftenen'
   
   ✅ EKSEMPEL:
   "Café, restaurant og bar med stor udendørs terrasse ved åen, der serverer kaffe og brunch om dagen og skifter til mad og cocktails om aftenen."
   
   ❌ FORBUDT: Tom streng, marketing-sprog, generiske beskrivelser
   ⚠️ VALIDATION: Dette felt SKAL være udfyldt. Tom streng = hard error.`
}

/**
 * Builds tone_of_voice field instructions
 * This is the most complex field with two-part format and dynamic example requirements
 */
export function buildToneOfVoiceInstructions(params: FieldInstructionParams): string {
  const { confirmedProgrammeSlots = [], languageName } = params
  const exampleCount = confirmedProgrammeSlots.length > 0 ? confirmedProgrammeSlots.length : 3
  const programmeOrder = confirmedProgrammeSlots.length > 0 
    ? confirmedProgrammeSlots.join(' → ') 
    : 'dag → aften → bar'
  
  const registerGuide = confirmedProgrammeSlots.length > 0
    ? confirmedProgrammeSlots.map((slot, i) => {
        const register = i === 0 
          ? 'lidt rummeligere — kortere sætninger, lidt mere luft' 
          : i === confirmedProgrammeSlots.length - 1 
            ? 'lakonisk — færrest mulige ord, ingen udfyldningsord' 
            : 'kortere og mere bestemt — direkte, ingen blød indledning'
        return `     - ${slot}: ${register}`
      }).join('\n')
    : `     - Dagsperiode: lidt rummeligere — kortere sætninger, lidt mere luft
     - Aftenperiode: kortere og mere bestemt — direkte, ingen blød indledning
     - Sen aften/bar: lakonisk — færrest mulige ord, ingen udfyldningsord`

  return `3) tone_of_voice.value — TWO-PART FORMAT
   Write this field in two clearly labelled sections, then Eksempel: lines.

   SECTION 1 — STEMME-MEKANIK (2–3 rules):
   Universal mechanics rules about HOW sentences are built. These are portable — they could apply to other venues in the same category.
   - Each rule: imperative verb + specific guidance. No period at end.
   - Must cover: sentence register (du/vi/man), tense (nutid), sentence length or rhythm.
   - FORBIDDEN: content tactics ("Indled med spørgsmål for engagement", "Afslut med CTA") — wrong section entirely.
   - Path A (writing samples): derive mechanics from observed owner rhythm — do NOT invent generic rules.
   - Path B no samples: derive EXACTLY 2–3 mechanics. Do NOT pad.
   Example mechanics (form only — do NOT copy these words): "Undgå hjælpeverber — aktiv form holder tempo", "Tal til én, ikke mange — 'du' frem for 'alle'", "Klip relativsætninger — ét verbum pr. sætning".
   CRITICAL: the examples above show the FORMAT (imperative + specific guidance) only. Derive mechanics from THIS business's actual signals — not from any wording in these instructions.

   SECTION 2 — STEMME-IDENTITET (2–3 rules):
   Voice POSTURE rules grounded in THIS business's specific SIGNAL PROFILE signals. These are NOT portable — a competitor with different signals cannot use them.
   - Each rule MUST name the specific signal it comes from in parentheses. SIGNAL KEYS — CLOSED SET (use exactly one, verbatim): meal_arc | price_register | location | venue_type | exclusion_list | dietary_flags. Do NOT invent compound keys, append Danish words to keys, or join keys with slashes.
   - Derive from confirmed signals in SIGNAL PROFILE: meal_arc, venue_type, price_register, location, dietary_flags, exclusion_list.
   - FALSIFICERINGSTEST (OBLIGATORISK): For each rule ask: "Kan en naborestaurant med et andet signal bruge denne regel?" Ja → kassér og omskriv med et smallere signal.
   - FORBIDDEN: generic rules that apply to all casual cafés. Rules must reference THIS venue's specific configuration.
   
   🚨 DEMOGRAPHIC VALIDATION (CRITICAL):
   Before writing ANY rule that mentions an audience type (studerende, turister, erhvervsgæster, familier, etc.):
   1. CHECK AUDIENCE PERMISSIONS block in the data section above
   2. IF the demographic shows "absent" or is not listed → DO NOT MENTION IT
   3. IF score < 40 → DO NOT MENTION IT
   4. NEVER write "appellerer til [geographic location]" — locations are WHERE, not WHO
      ❌ WRONG: "Skriv med en tone der appellerer til byens centrum" (city_centre is a LOCATION, not an audience)
      ✅ RIGHT: "Skriv med en tilgængelig tone der passer til centrumområdet" (describes location context, not audience appeal)
   5. ONLY use demographic labels if explicitly permitted by AUDIENCE PERMISSIONS with "primary" or "secondary" strength
   
   GOOD examples (these would FAIL at a different venue):
     'Stedet har et konkret fysisk anker — skriv det som aktør i situationen, ikke som stemningsbaggrund' (signal: location)
     'Første service og sen aften er ikke det samme gæsteforhold — ton ned med klokkeslættet' (signal: meal_arc)
     'Sproget behøver ikke appellere til studerende — de er ekskluderet konceptmæssigt' (signal: exclusion_list)
   BAD examples (portable to any café — would PASS at a competitor — FORBIDDEN):
     'Skriv som en person, ikke et reklamebureau' (no specific signal — fails test)
     'Vær uformel og varm' (no signal — fails test)
     'Skriv med en tone der appellerer til både studerende og byens centrum' (treats location as audience + uses unpermitted demographic — FORBIDDEN)

   FORMAT strictly:
   STEMME-MEKANIK:
   - [regel]
   - [regel]
   STEMME-IDENTITET:
   - [identitetsregel (signal: ...)]
   - [identitetsregel (signal: ...)]
   Eksempel: "[eksempel]"
   Eksempel: "[eksempel]"

   BEFORE WRITING EKSEMPEL LINES: Re-read the STEMME-MEKANIK rules you just wrote above. Each Eksempel line MUST demonstrate those exact mechanics rules.

   EKSEMPEL LINES — quantity:
   - Non-hybrid venue: EXACTLY 2 Eksempel: lines.
   - Hybrid venue (SIGNAL PROFILE contains dag_til_aften_arc OR meal_arc lists ≥2 programme roles):
     Write ${exampleCount} Eksempel: lines — one per confirmed programme from OPERATIONAL PROGRAMMES (in this order: ${programmeOrder}).
     Each line demonstrates the REGISTER shift for that programme period.
     Register guide per slot:
${registerGuide}

   EKSEMPEL LINES — content rules:
   - Each Eksempel: line must be a COMPLETE, REAL sentence — NOT a label, NOT a bracket description, NOT a placeholder.
   - FORBIDDEN output formats: "[BRUNCH — lidt rummeligere]", "[AFTEN — kortere]", any text inside [ ] brackets.
   - Demonstrate REGISTER ONLY: rhythm and tone, nothing else.
   - FORBIDDEN content: location, setting, menu items, CTA, dish names.
   - WRONG: "Oplev café-kulturen ved vandet" (location), "Nyd carpaccio" (menu), "Bestil bord til fredag" (CTA).
   - RIGHT: "Vi er klar." (register only — neutral, clear, complete sentence)
   - RIGHT: "Kom forbi." (register only — direct, brief, complete sentence)
   - RIGHT: "Det tager ti minutter." (rhythm only — facts-free, no context)
   - CRITICAL: Do NOT copy or paraphrase any sentence shown as RIGHT: in these instructions. Write fresh lines that demonstrate the STEMME-MEKANIK rules you derived.
   - Do NOT label or annotate the lines — just write ${exampleCount} sequential Eksempel: lines, each a real sentence.

3a) tone_model — FIELD REQUIREMENTS
   ALL FOUR sub-fields are REQUIRED: primary_keywords, writing_rules, good_examples, avoid_examples.

   tone_model.primary_keywords (2–6 words):
   - 2–6 single words that capture the WRITING STYLE only (NOT the brand identity, menu, or location).
   - Examples of valid keywords: "direkte", "jordnær", "uformel", "varm", "præcis".
   - Do NOT use brand identity words like "autentisk", "hyggeligt", "lokalt" — those belong in brand_essence.

   tone_model.writing_rules (2–8 rules):
   - Rules about STYLE ONLY: sentence rhythm, register, du/vi/man usage, tense, punctuation.
   - MANDATORY: at least ONE rule must address how to write non-food/atmosphere posts —
     specifically how to anchor to a confirmed venue fact WITHOUT inventing interior details
     (furniture, floors, windows, light). Example rule form: "Åbn atmosfære-opslag med en
     menneskelig handling eller et konkret tidspunkt — aldrig med en rumsbeskrivelse."
   - MANDATORY: if kitchen_close_time or late_night_venue=true is in OPERATIONS, include ONE
     rule about the temporal arc (day programme → bar arc) — how tone should modulate between
     the two service modes (e.g. slightly more direct/brief in bar arc vs. daytime).
   - Rules must be imperative + specific. No periods at end.

   tone_model.good_examples (1–6 examples):
   - Demonstrate WRITING STYLE ONLY — rhythm and register, NOT facts about this business.
   - WRONG: "Nyd carpaccio ved åen" (dish name + location — NOT allowed)
   - WRONG: "Bestil bord til fredag aften" (CTA — NOT allowed)
   - RIGHT: "Vi er klar." (register only — neutral, clear)
   - RIGHT: "Det tager ti minutter." (rhythm only — facts-free, no context)
   - A reader should NOT be able to identify the business from these examples alone

   tone_model.avoid_examples (1–6 examples):
   - Phrases that represent the WRONG register or style for this voice. Format: phrase + brief reason.
   - Example: "Oplev den autentiske stemning (for kampagneagtig tone — undgå reklamesprog)"
   - Do NOT include brand-specific facts or menu items — wrong STYLE only.

3b) voice_constraints.value
   - ONE principle sentence explaining WHY this tone fits this specific business
   - NOT a list of forbidden words — a principle AI can reason from
   - Example: "Undgå ord der lyder som de hører hjemme i et reklamefirma — dette sted kommunikerer som en person, ikke en kampagne"`
}

/**
 * Builds content_focus field instructions
 */
export function buildContentFocusInstructions(): string {
  return `4) content_focus.value
   - FORMAT: MUST be exactly 3–4 bullet points, each starting with "- ". No prose. No numbered list.
   - USAGE-DRIVEN: derive from CONTENT TRIGGERS what_to_show + copy_angles
   - Required coverage: (1) food/service observable, (2) atmosphere/experience/flow, (3) behavioral moments/people
   - Optional 4th bullet: BTS/process/transitions if supported by data
   - Multi-signal threshold: ≥2 different signals = SUFFICIENT evidence
   - NOT allowed: Menu-only focus ("Fokus på brunch og frokost")
   - For waterfront/outdoor venues: atmosphere bullet should reference the location setting (åen, haven, udeservering) — NOT interior`
}

/**
 * Builds image_preferences field instructions
 */
export function buildImagePreferencesInstructions(): string {
  return `5) image_preferences — dos: [3 items], donts: [3 items], signature_shot: 1 iconic description
   - dos[0]: reference the mandatory location phrase
   - donts: focus on tone mismatches and generic stock-photo feel ONLY
   - signature_shot: scene + lighting + people/objects + location phrase`
}

/**
 * Builds cta_style field instructions
 */
export function buildCtaStyleInstructions(): string {
  return `6) cta_style.value
   - MUST define BOTH: primary CTA (booking) AND 2-3 secondary soft CTAs
   - Not allowed: single CTA only`
}

/**
 * Builds content_strategy field instructions
 */
export function buildContentStrategyInstructions(): string {
  return `7) content_strategy
   - FIRST: silently classify the business on maturity (emerging/growing/established) and concept distinctiveness (commodity/distinctive_concept/destination_experience) using the evidence in the data. These are reasoning steps only — do NOT output them as fields.
   - primary_goal: the single dominant goal derived from maturity × orientation (see system prompt rules)
   - goal_blend: percentages summing to 100 using the maturity-anchored ranges from system prompt. CONSTRAINT: if emerging, retain_loyalty must be lowest. Justify your classification in your internal reasoning before committing to numbers.
   - footfall_signals: derive from USAGE OCCASIONS and business type (e.g. "weekend dinner service")
   - brand_anchors: derive from DISTINCTIVE HOOKS and brand identity signals. For commodity businesses: focus on execution quality and specific dishes, not concept narrative.
   - loyalty_hooks: derive from RITUALS & MOMENTS and repeat-visit patterns. For emerging businesses: forward-looking language only — do not fabricate existing loyalty. For established businesses: must be specific and earned, not generic.
   - LOCATION RULE: use the precise location type from LOCATION ENRICHMENT ("åen", "fjorden", "søen", "havnen", "stranden", "bugten"). 
     "vandet" is ONLY for open sea/coast — it is incorrect for rivers, lakes, fjords, bays and harbours.
     DEFAULT for waterfront: "ved åen" (most Danish waterfront venues are by streams/rivers).
   - content_category_weights: percentages summing to 100; apply concept distinctiveness modifiers from system prompt (destination_experience boosts craving_visual, distinctive_concept boosts behind_scenes, established boosts team_people)`
}

/**
 * Builds voice_examples field instructions
 */
export function buildVoiceExamplesInstructions(languageName: string): string {
  return `8) voice_examples — BRAND DISPLAY LAYER (shown to business owner, NOT injected into caption AI except vocabulary)
   - do_say: MINIMUM 3 brand-authentic phrases — INCLUDE location anchors, specific CTAs, place marketing hooks here verbatim
   - dont_say: MINIMUM 3 phrases (wrong tone, too generic, wrong personality)
   - vocabulary.prefer: MINIMUM 5 words — these DO feed the caption AI as soft word signals
   - vocabulary.avoid: MINIMUM 5 words — these DO feed the caption AI as suppressed words
   - NOTE: tone_model.good_examples feeds caption AI style; do_say/dont_say are for display only

OUTPUT: Return complete Brand Profile JSON matching all required fields.
Write in ${languageName}.`
}

/**
 * Main builder function that assembles all field instructions
 */
export function buildFieldInstructions(params: FieldInstructionParams): string {
  const sections = [
    buildVoiceRationaleInstructions(),
    buildBusinessCharacterInstructions(),
    buildToneOfVoiceInstructions(params),
    buildContentFocusInstructions(),
    buildImagePreferencesInstructions(),
    buildCtaStyleInstructions(),
    buildContentStrategyInstructions(),
    buildVoiceExamplesInstructions(params.languageName),
  ]
  
  return sections.join('\n\n')
}
