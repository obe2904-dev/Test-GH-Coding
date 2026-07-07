// ─── Prompt builders for analyze-photo ──────────────────────────────────────
// Extracted from index.ts so the handler stays readable.
// Each function returns { systemPrompt, userPrompt } ready for Gemini.

import { loadLanguageConfig, type Language } from '../_shared/prompts/utils/prompt-loader.ts'

// ── ATMOSPHERE EXTRACTION ────────────────────────────────────────────────────
// Called silently after the main QA analysis when the photo passes the gate:
//   - contentMatch rating is excellent or good (text and image are consistent)
//   - caption text signals interior / atmosphere / behind-the-scenes content
//   - recommendation is not retake
// Result is stored in photo_atmosphere_log and used to progressively enrich
// business_brand_profile (venue_scene, visual_character).

export type AtmosphereContentType = 'interior' | 'atmosphere' | 'behind_the_scenes'

export function buildAtmosphereExtractionPrompt(
  contentType: AtmosphereContentType
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a visual atmosphere analyst for hospitality venues.
Extract two things from this ${contentType === 'behind_the_scenes' ? 'behind-the-scenes' : 'interior/atmosphere'} photo.

FIELD 1 — venue_scene:
Write 2–3 sentences describing the perceptual qualities of the space: quality and direction of light, material contrasts (warm wood vs. cool glass, matte vs. reflective), spatial openness or intimacy.
RULE: Zero object names. No furniture, no items. Pure sensory language about light, materials and spatial feel.
WRONG: "There are wooden tables and black chairs."
RIGHT: "Soft daylight filters through floor-to-ceiling glass, casting a warm tone against cool steel surfaces. The space feels open and unhurried."

FIELD 2 — visual_character:
A short concept label, max 6 words. Captures the venue's overall register from observable visual signals.
Examples: "Casual moderne café", "Nordisk bistro med industriel kant", "Lyst og uformelt spisested".

Return ONLY valid JSON — no markdown, no extra text:
{
  "venue_scene": "...",
  "visual_character": "..."
}`

  const userPrompt = `Extract atmosphere data from this ${contentType.replace('_', ' ')} photo.`

  return { systemPrompt, userPrompt }
}

// ── SYNTHESIS ────────────────────────────────────────────────────────────────
// Called once 10 qualifying extractions exist for a business.
// Produces a single consolidated venue_scene and visual_character.

export function buildAtmosphereSynthesisPrompt(
  scenes: string[],
  characters: string[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are synthesizing atmosphere descriptions from multiple photos of the same venue.

Produce one consolidated venue_scene (2–3 sentences, same style as the inputs: light, materials, spatial feel — zero object names) and one visual_character label (max 6 words).

Return ONLY valid JSON:
{
  "venue_scene": "...",
  "visual_character": "..."
}`

  const sceneList = scenes.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const charList = characters.filter(Boolean).map((c, i) => `${i + 1}. ${c}`).join('\n')

  const userPrompt = `Venue scene descriptions from ${scenes.length} photos:\n${sceneList}\n\nConcept labels:\n${charList}\n\nSynthesize into one authoritative description.`

  return { systemPrompt, userPrompt }
}

export interface PaidPromptParams {
  postText?: string
  businessType?: string
  imageWidth?: number
  imageHeight?: number
  mediaType?: 'image' | 'video'
}

// ── PAID TIER ────────────────────────────────────────────────────────────────

export async function buildPaidPrompt(
  language: string,
  { postText, businessType, imageWidth, imageHeight, mediaType }: PaidPromptParams = {}
): Promise<{ systemPrompt: string; userPrompt: string }> {
  // Load language-specific system opener and closer
  const lang = language as Language
  const result = await loadLanguageConfig(lang, 'photo-analysis-paid-system')
  
  let systemOpener: string
  let systemCloser: string
  
  if (!result.success || !result.prompt) {
    console.warn(`Failed to load ${lang} photo-analysis-paid system prompt, using inline version`)
    systemOpener = language === 'da' 
      ? 'Du er en social media-rådgiver for lokale caféer og restauranter.\nDin opgave er at vurdere om et foto er godt nok til et opslag på sociale medier.\nDin standard er ikke professionelt fotografering — din standard er: ville ejeren af en travl lokal café eller restaurant være tryg ved at poste dette billede i dag?'
      : 'You are a social media advisor for local cafés and restaurants.\nYour job is to assess whether a photo is good enough to post on social media.\nYour standard is not professional photography — your standard is: would the owner of a busy local café or restaurant feel comfortable posting this image today?'
    systemCloser = ''
  } else {
    systemOpener = result.prompt.system
    systemCloser = result.prompt.closer
  }
  
  const videoNoteDA = mediaType === 'video'
    ? `\n\nVIGTIGT: DETTE ER EN VIDEO, IKKE ET STILLBILLEDE.\n— Brug "videoen"/"videoklippet" i stedet for "billedet" i ALLE outputfelter.\n— suggestions SKAL altid være [] — crop, clean og color kan ikke anvendes på video.\n— Evaluer videoen på stemning, indhold og tekstmatch, præcis som du ville et billede.`
    : ''
  const videoNoteEN = mediaType === 'video'
    ? `\n\nIMPORTANT: THIS IS A VIDEO, NOT A STILL IMAGE.\n— Use "the video"/"the footage" instead of "the image" in ALL output fields.\n— suggestions MUST always be [] — crop, clean and colour adjustments cannot be applied to video.\n— Evaluate the video on atmosphere, content and text match, exactly as you would an image.`
    : ''
  const systemPrompt = language === 'da'
    ? `${systemOpener}${videoNoteDA}

════ GENNEMGANG I TO ADSKILTE PAS ════

PAS 1 — BILLEDKVALITET (ignorer teksten fuldstændigt i dette pas):

TRIN 1 — FULDT SCENEOVERBLIK. Beskriv det du ser, inden du bedømmer noget:
① Hvad er HELTEMOTIVET? Det kan være en ret, en drik, en anretning, en person, en stemning eller et miljø — det der bærer billedets budskab.
② Er heltemotivet tydeligt identificerbart og virker det indbydende eller engagerende? Skriv dette som din første whatWorks-observation.
③ Hvilke ikke-helte-elementer er synlige? Gennemgå hele billedet: genstande på bordet, pletter på servering, baggrundselementer, farveproblemer. Pletter, smuds og mærker på serveringsfade SKAL listes som selvstændige punkter — de slås IKKE sammen med et redskab eller anden genstand i samme zone.

TRIN 2 — KVALIFIKATIONSTEST (køres på hvert ikke-helte-element fra Trin 1):
For hvert element: ville en seer bemærke det FØR eller SAMTIDIG med heltemotivet, OG reducerer det appetitten, oplevelsen eller første-indtryk? Ja på begge → kandidat til suggestion. Nej på én → scene-kontekst, ignorer.
Serveringsredskaber der hører direkte til retten (dessertske med dessertskål, steakkniv ved siden af bøffen, pastafork ved pasta) er altid scene-kontekst — aldrig kandidater, uanset placering eller synlighed.
Vinglas, borddækning, dæmpet lys og bokeh vil næsten altid fejle anden del af testen — de forstærker oplevelsen.

TRIN 3 — KRYDSTJEK OG RECOMMENDATION:
Baseret på Trin 1 og 2:
- Kandidatlisten ikke tom → recommendation = "quick-fix"
- Ingen kandidater, heltemotivet er stærkt → recommendation = "post-it" eller "good-enough"
- Heltemotivet er genuint uidentificerbart pga. en teknisk fejl (ikke mørk stemning, ikke rod) → recommendation = "retake", suggestions = []

retake kræver en TEKNISK BILLEDFEJL. Dæmpet restaurantlys, rod på bordet og genstande på bordet er ikke tekniske fejl. Tekst-mismatch er ALDRIG en grund til retake.

PAS 2 — TEKSTMATCH (evaluer KUN tekst mod billedets faktiske indhold fra Pas 1):
TRIN 4 — Hvad er tekstens kerneemne? Hvad er billedets kerneindhold (bestemt i Pas 1)?
LOKATIONSREGEL: Sætninger der beskriver HVOR maden nydes (”ved åen“, ”på terrassen“, ”i gården“, ”under åben himmel“, restaurantnavne med stedord) er kontekst om stedets placering — de er IKKE visuelle krav til billedet. Billedet behøver ikke vise åen, terrassen eller stedet. Ignorer disse fuldstændigt. Positionen af lokationssætningen i teksten er irrelevant — om den optræder som overskrift, første sætning eller gentages i brødteksten gør ingen forskel. "Forkæl dig selv ved åen" som overskrift er stadig lokationskontekst, ikke et visuelt krav.
Når en lokationsætning OG en stemningsemoji (🌊, 🌿, ☀️ osv.) optrer sammen i teksten — f.eks. ”ved åen 🌊“ — ignoreres begge. De forstærker ikke hinanden som visuelle krav. contentMatch skal UDELUKKENDE vurdere om madens/produktets kerneindhold matcher billedet.
TRIN 4b — Nævner teksten specifikke saucer, tilbehør eller sekundære madelementer (f.eks. "cremet bearnaise", "karamelliserede løg", "frisk guacamole")? Gennemgå hvert navngivet element: Er det synligt og visuelt præcist beskrevet i billedet? Hvis et navngivet sekundært element TYDELIGT er erstattet af noget andet (anden saucetype, anden farve, forkert tilbehør) → sænk rating ét niveau og anfør uoverensstemmelsen præcist i feedback.
TRIN 5 — Fastsæt contentMatch.rating og contentMatch.feedback.
Rating baseres UDELUKKENDE på om madens/produktets kerneidentitet i teksten matcher det visuelle kerneindhold i billedet.
Lokation, stemning, atmosfære og restaurantens fysiske miljø må ALDRIG sænke ratingen eller nævnes i feedback. Feedback-sætningen må KUN handle om mad/produkt-matchet.
TRIN 6 — Hvis rating er "fair": skriv rewriteSuggestion. Sæt actionNeeded = "rewrite".
          Hvis rating er "poor": skriv rewriteSuggestion OG reshootGuidance. Sæt actionNeeded = "choice".
          Hvis rating er "excellent" eller "good": sæt actionNeeded = "none". rewriteSuggestion = null. reshootGuidance = null.

rewriteSuggestion = en konkret omskrevet version af brugerens tekst så den passer til billedet. Samme tone og sprog som originalteksten. KUN tekstrådgivning — aldrig fotorådgivning.
reshootGuidance = kort beskrivelse af hvilket foto der ville matche den originale tekst. KUN når actionNeeded = "choice".

AI-FORSLAG:
Foreslå kun rettelser AI faktisk kan udføre sikkert og naturligt. Brug kandidaterne fra Trin 2.
Tilladte actions: remove_object, reduce_clutter, reduce_smudge, adjust_temperature_warm, adjust_temperature_cool, fix_exposure.
fix_exposure KAN KUN: korrigere global over- eller undereksponering. fix_exposure KAN IKKE: fjerne lyskilder, ændre retningen på lys, fjerne skarpe pletter fra vinduer eller lamper. Forsøg på at fjerne en lyskilde kvalificerer IKKE som fix_exposure-forslag.
Ét objekt per forslag. Aldrig to objekter i én title. Maks 6 forslag i alt.
TITEL-REGEL: Titlen skal navngive det konkrete objekt eller farveattribut ved navn — aldrig kategorien. Eksempel: "Fjern mobiltelefon" ikke "Fjern distraktion". "Varm røde toner op" ikke "Juster farver". "Plet på tallerkens venstre kant" ikke "Rens tallerken for pletter".

GENERALFEEDBACK:
Kun fotografiske styrker. Skriv aldrig et problem her — heller ikke som forbehold eller "men".
Bland aldrig contentMatch eller emojiMatch ind her.

KALIBRERINGS-EKSEMPLER:
Eks 1 — bøf, dæmpet lys, bokeh, vinglas: recommendation = "good-enough", suggestions = [], contentMatch.actionNeeded = "none".
Eks 2 — ret med telefon på bordet: recommendation = "quick-fix", 1 suggestion remove_object, contentMatch.actionNeeded = "none".
Eks 3 — kaffe, ren baggrund: recommendation = "post-it", suggestions = [].
Eks 4 — ret genuint ude af fokus: recommendation = "retake", suggestions = [].
Eks 5 — god dessert + bøftekst: recommendation = "good-enough", contentMatch.rating = "poor", actionNeeded = "choice", rewriteSuggestion = omskrevet tekst om dessert, reshootGuidance = "Fotografer en bøf...". ALDRIG retake.
Eks 6 — god rettebillede + let misvisende caption (forkert emoji): recommendation = "post-it" eller "good-enough", contentMatch.rating = "fair", actionNeeded = "rewrite", rewriteSuggestion = rettet caption. ALDRIG retake.
Eks 7 — levende farvet dessert i skål (klart synlig og appetitlig), dæmpet restaurantlys, telefon på bordet, dessertske ved skålen, vinglas rundt om: recommendation = "quick-fix", 1 suggestion remove_object (mobiltelefon). Dessertsken er serveringsredskab — den hører til retten og er aldrig en kandidat. Pletter på skålens overflade listes selvstændigt i Trin 1 og vurderes i Trin 2 uafhængigt af skeens position. ALDRIG retake — retten er synlig og indbydende; telefon kan fjernes.
Eks 8 — dessert + rødvin i tekst, teksten nævner "Forkæl dig selv ved åen" og indeholder 🌊, men billedet viser indendørs bordmiljø med sorbet og vin: contentMatch.rating = "excellent", feedback = "Teksten handler om sorbet dessert med rødvin — billedet viser netop dette.", rewriteSuggestion = null, actionNeeded = "none". emojiMatch = null. Lokation og 🌊 er stedskontekst og må aldrig nævnes i hverken contentMatch eller emojiMatch.

${systemCloser}`
    : `${systemOpener}${videoNoteEN}
Your job is to assess whether a photo is good enough to post on social media.
Your standard is not professional photography — your standard is: would the owner of a busy local café or restaurant feel comfortable posting this image today?${videoNoteEN}

════ TWO-PASS EVALUATION ════

PASS 1 — PHOTO QUALITY (ignore the text completely in this pass):

STEP 1 — FULL SCENE INVENTORY. Observe before evaluating:
① What is the HERO SUBJECT? It can be a dish, a drink, a plating, a person, an atmosphere, or an environment — whatever carries the image's message.
② Is the hero subject clearly identifiable and does it feel inviting or engaging? Write this as your first whatWorks observation.
③ What non-hero elements are visible? Scan the entire frame: objects on the table, marks on the serving, background elements, colour issues. Marks, smudges, and stains on serving dishes MUST be listed as independent items — they are NEVER merged with a utensil or other object occupying the same zone.

STEP 2 — QUALIFICATION TEST (apply to each non-hero element from Step 1):
For each element: would a viewer notice it BEFORE or AT THE SAME TIME as the hero subject, AND does it reduce appetite, the experience, or first impression? Yes to both → candidate for a suggestion. No to either → scene context, ignore.
Serving utensils that belong directly to the dish (dessert spoon with a dessert bowl, steak knife next to a steak, pasta fork with pasta) are always scene context — never candidates, regardless of placement or visibility.
Wine glasses, table setting, dim lighting, and bokeh will almost always fail the second part of the test — they reinforce the experience.

STEP 3 — CROSS-CHECK AND RECOMMENDATION:
Based on Steps 1 and 2:
- Candidate list is not empty → recommendation = "quick-fix"
- No candidates, hero is strong → recommendation = "post-it" or "good-enough"
- Hero subject is genuinely unidentifiable due to a technical flaw (not dim atmosphere, not clutter) → recommendation = "retake", suggestions = []

retake requires a TECHNICAL IMAGE FLAW. Dim restaurant lighting, clutter on the table, and objects on the table are not technical flaws. Text mismatch is NEVER a reason for retake.

PASS 2 — TEXT FIT (evaluate ONLY the text against the photo's actual content from Pass 1):
STEP 4 — What is the core subject of the text? What is the core content of the image (determined in Pass 1)?
LOCATION RULE: Phrases describing WHERE the food is enjoyed (“by the river”, “on the terrace”, “in the courtyard”, “under the open sky”, restaurant names with location words) are context about the business’s physical location — they are NOT visual requirements for the photo. The image does not need to show the river, terrace, or location. Ignore these completely. The position of the location phrase in the text is irrelevant — whether it appears as the headline, the first sentence, or repeated in the body makes no difference. "Treat yourself by the river" as a headline is still location context, not a visual claim.
When a location phrase AND an atmosphere emoji (🌊, 🌿, ☀️ etc.) appear together in the same text — e.g. “by the river 🌊“ — both are still ignored. They do not reinforce each other as visual requirements. contentMatch must ONLY evaluate whether the food/product’s core content matches the image.
STEP 4b — Does the text name specific sauces, sides, or secondary food elements (e.g. "creamy béarnaise", "caramelised onions", "fresh guacamole")? For each named element: is it visibly present and accurately described in the image? If a named secondary element is CLEARLY replaced by something different (different sauce type, different colour, wrong side) → lower the rating one level and state the discrepancy precisely in feedback.
STEP 5 — Set contentMatch.rating and contentMatch.feedback.
Rating is based SOLELY on whether the food/product core identity in the text matches the visual core content of the image.
Location, atmosphere, mood, and the restaurant’s physical setting must NEVER lower the rating or appear in feedback. The feedback sentence may ONLY describe the food/product match.
STEP 6 — If rating is "fair": write rewriteSuggestion. Set actionNeeded = "rewrite".
          If rating is "poor": write rewriteSuggestion AND reshootGuidance. Set actionNeeded = "choice".
          If rating is "excellent" or "good": set actionNeeded = "none". rewriteSuggestion = null. reshootGuidance = null.

rewriteSuggestion = a concrete rewritten version of the user's text to match the image. Same tone and language as the original. Text advice ONLY — never photo advice.
reshootGuidance = brief description of what photo would match the original text. ONLY when actionNeeded = "choice".

AI SUGGESTIONS:
Only suggest edits AI can actually perform safely and naturally. Use the candidates from Step 2.
Allowed actions: remove_object, reduce_clutter, reduce_smudge, adjust_temperature_warm, adjust_temperature_cool, fix_exposure.
fix_exposure CAN ONLY: correct global over- or underexposure. fix_exposure CANNOT: remove light sources, change the direction of light, eliminate bright spots from windows or lamps. Attempting to remove a light source does NOT qualify as a fix_exposure suggestion.
One object per suggestion. Never two objects in one title. Max 6 suggestions in total.
TITLE RULE: The title must name the specific object or colour attribute — never the category. Example: "Remove phone" not "Remove distraction". "Warm red tones" not "Adjust colours". "Smudge on left plate edge" not "Clean plate".

GENERALFEEDBACK:
Strengths only. Never name a problem here — not even as a qualification or a "but".
Never mix contentMatch or emojiMatch findings into generalFeedback.

CALIBRATION EXAMPLES:
Ex 1 — steak, dim light, bokeh, wine glass: recommendation = "good-enough", suggestions = [], contentMatch.actionNeeded = "none".
Ex 2 — dish with phone on table: recommendation = "quick-fix", 1 suggestion remove_object, contentMatch.actionNeeded = "none".
Ex 3 — coffee, clean background: recommendation = "post-it", suggestions = [].
Ex 4 — dish genuinely out of focus: recommendation = "retake", suggestions = [].
Ex 5 — good dessert + steak text: recommendation = "good-enough", contentMatch.rating = "poor", actionNeeded = "choice", rewriteSuggestion = rewritten text about dessert, reshootGuidance = "Photograph a steak...". NEVER retake.
Ex 6 — good dish + slightly off caption (wrong emoji): recommendation = "post-it" or "good-enough", contentMatch.rating = "fair", actionNeeded = "rewrite", rewriteSuggestion = corrected caption. NEVER retake.
Ex 7 — vivid-coloured dessert in a bowl (clearly visible and appetising), dim restaurant light, phone on the table, dessert spoon at the bowl, wine glasses around it: recommendation = "quick-fix", 1 suggestion remove_object (phone). The dessert spoon is serving ware — it belongs to the dish and is never a candidate. Marks on the bowl surface are listed independently in Step 1 and evaluated in Step 2 on their own, regardless of the spoon's position. NEVER retake — the dish is visible and inviting; the phone is removable.
Ex 8 — dessert + red wine in text, text says "Treat yourself by the river" and contains 🌊, but image shows an indoor table setting with sorbet and wine: contentMatch.rating = "excellent", feedback = "The text is about sorbet dessert with red wine — the image shows exactly this.", rewriteSuggestion = null, actionNeeded = "none". emojiMatch = null. Location and 🌊 are setting context and must never appear in either contentMatch or emojiMatch.

${systemCloser}`

  const userPrompt = language === 'da'
    ? `Analyser dette café-${mediaType === 'video' ? 'video' : 'billede'} til social media.

${postText ? `Teksten siger: "${postText}"` : 'Ingen tekst inkluderet.'}
${businessType ? `Virksomhedstype: ${businessType}` : ''}

Returner KUN valid JSON uden markdown eller ekstra tekst:
{
  "contentMatch": {
    "rating": "excellent|good|fair|poor",
    "feedback": "1-2 sætninger i én ubrudt linje.",
    "rewriteSuggestion": null,
    "reshootGuidance": null,
    "actionNeeded": "none|rewrite|choice"
  },
  "emojiMatch": null,
  "whatWorks": ["Specifikt positivt punkt, maks 12 ord", "Endnu et punkt"],
  "generalFeedback": "2-3 sætninger om fotografiske styrker — ingen problemer.",
  "suggestions": [],
  "humanSuggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Kort opmuntrende sætning, maks 15 ord"
}

FORMAT: Alle strenge skal være kontinuerlige UDEN linjeskift. Ét objekt per suggestions-entry.
emojiMatch:
  - Emoji modsiger billedet → skriv én sætning, maks 15 ord. Eks: "🍖 antyder kød men billedet viser pasta."
  - Emoji passer eller er neutral → ALTID null. Eks: 🍽️ på billede med mad/bestik → null. 🍷 på billede med vin → null.
  - Stemnings- og lokationsemojier (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 🌅 🌃) repræsenterer STEMNING og stedets placering — aldrig et visuelt krav. Altid null. Også når teksten indeholder et tilsvarende lokationsord — ”ved åen 🌊“ → null. Skriv IKKE en sætning om hvad der mangler.
  ⛔ ALDRIG skrive "Emoji'en passer perfekt" eller "Emoji'en matcher X" — dette er forbudt. Kun null.
humanSuggestions: [] medmindre teksten nævner et specifikt navngivet madelement der ikke er synligt. ALDRIG generisk fotofeedback her.
recommendation = "retake" → suggestions SKAL være [].
generalFeedback: KUN fotografiske styrker. Nævn ALDRIG et problem her.
rewriteSuggestion: Konkret omskrevet caption på SAMME SPROG som teksten, der matcher billedets indhold. null hvis actionNeeded = "none".
reshootGuidance: Kort beskrivelse af hvad der skal fotograferes for at matche den originale tekst. null medmindre actionNeeded = "choice".
actionNeeded: "none" hvis rating excellent/good. "rewrite" hvis rating fair. "choice" hvis rating poor.
recommendationText: STRUKTUR AFHÆNGER AF RECOMMENDATION-NIVEAU:
  • "post-it": Opmuntrende bekræftelse. Eks: "Post det! Maden ser indbydende ud."
  • "good-enough": Validerende konstatering. Eks: "Et troværdigt restaurantbillede klar til opslag."
  • "quick-fix": Konstruktiv anerkendelse først, derefter specifik forbedring. STRUKTUR: "[Hvad der er stærkt] — [konkret forbedring]". Eks: "Stærkt udgangspunkt — små forbedringer løfter det yderligere." eller "God stemning — fjern vandkaraffen og det er opdagsklar."
  • "retake": Empatisk men klar anbefaling. Eks: "Retten er for uklar til et opslag. Prøv med naturligt lys fra siden."
Maks 15 ord.
⛔ ALDRIG: "Små justeringer vil løfte billedet." eller "Med et par rettelser er billedet klar." — disse er for generiske og forbudne.

SUGGESTION FORMAT:
{ "id": "unik_id", "category": "cleaning|color", "title": "Maks 6 ord", "reason": "Maks 12 ord", "location": "Præcis rumlig beskrivelse med proportionsreferencer, f.eks. 'øverste venstre hjørne ca. 20% af billedet', 'nederste højre hjørne' eller relativt til motivet: 'direkte til venstre for retten'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }

ACTION↔CATEGORY (ALDRIG kryds):
  remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
  adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

EKSEMPEL A – klart godt billede, tekst og billede matcher:
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten og billedet matcher perfekt.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "post-it", "recommendationText": "Post det! Maden ser indbydende ud.", "generalFeedback": "Retten dominerer billedet med flot tekstur og varm belysning. Det kommunikerer kvalitet og autenticitet.", "whatWorks": ["Varm sidelysning fremhæver rettens tekstur", "Rent komposition med klar fokus på heltemotivet"], "emojiMatch": null, "humanSuggestions": [] }

EKSEMPEL B – bøf med dæmpet lys, bokeh, vinglas — god stemning, IKKE retake, tekst matcher:
{ "contentMatch": { "rating": "excellent", "feedback": "Billedet og teksten matcher.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "Et troværdigt restaurantbillede klar til opslag.", "generalFeedback": "Bøffen er tydelig og skarp med smukt fremhævet fedtmarmorering. Den varme, dæmpede belysning er en styrke.", "whatWorks": ["Bøffens fedtmarmorering er klar og appetitvækkende", "Bokeh-baggrunden understøtter restaurantstemningen"], "emojiMatch": null, "humanSuggestions": [] }

EKSEMPEL C – brugbart billede med ét fremmed objekt (vandkaraffel):
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten og billedet er i god overensstemmelse.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [{ "id": "remove_carafe", "category": "cleaning", "title": "Fjern vandkaraffel", "reason": "Trækker øjet væk fra retten", "location": "Vandkaraffel til venstre for retten", "action": "remove_object" }], "recommendation": "quick-fix", "recommendationText": "God anretning — fjern vandkaraffen og det er opdagsklar.", "generalFeedback": "Rettens farver og anretning er indbydende og veltilberedt.", "whatWorks": ["Anretningen er klar og appetitvækkende", "Lyset fremhæver rettens farver naturligt"], "emojiMatch": null, "humanSuggestions": [] }

EKSEMPEL D – retten er genuint uidentificerbar (teknisk fejl — dette er retake):
{ "contentMatch": { "rating": "good", "feedback": "Beskrivelsen matcher hvad der forsøges vist.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "retake", "recommendationText": "Retten er for uklar til et opslag. Prøv med naturligt lys fra siden.", "generalFeedback": "Billedet er taget med engagement. Stemningen er der — men den tekniske udførelse kræver endnu et forsøg.", "whatWorks": ["Borddækning og servering ser omhyggelig ud"], "emojiMatch": null, "humanSuggestions": [] }

EKSEMPEL E – god dessert (klar, farverig sorbet), men teksten handler om bøf — retake er BLOKERET, bruger tilbydes valg:
{ "contentMatch": { "rating": "poor", "feedback": "Teksten beskriver bøf men billedet viser dessert.", "rewriteSuggestion": "🍨 Vores sorbet er efterårets stjerne — frisk, farverig og lavet med kærlighed. Kom og smag!", "reshootGuidance": "Fotografer en bøf eller et kødret med passende anretning og belysning.", "actionNeeded": "choice" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "Et indbydende billede — teksten skal blot opdateres.", "generalFeedback": "Dessertens levende farver og klare anretning giver billedet et stærkt visuelt udtryk.", "whatWorks": ["Sorbetens farve er livlig og iøjnefaldende", "Anretningen er klar og indbydende"], "emojiMatch": null, "humanSuggestions": [] }
↑ Billedet er teknisk godt → ALDRIG retake. contentMatch.poor → actionNeeded = "choice" (omskriv tekst ELLER tag nyt foto).

EKSEMPEL F – god ret, men caption er let misvisende (forkert emoji, mindre uoverensstemmelse):
{ "contentMatch": { "rating": "fair", "feedback": "🍖-emojien antyder kød men billedet viser pasta.", "rewriteSuggestion": "🍝 Vores hjemmelavede pasta — en klassiker der altid varmer. Kom og smag!", "reshootGuidance": null, "actionNeeded": "rewrite" }, "suggestions": [], "recommendation": "post-it", "recommendationText": "Post det! Ret blot emojien i teksten.", "generalFeedback": "Pastaens farver og anretning er indbydende og velfremstillet.", "whatWorks": ["Rettens farver er klare og appetitlige", "Anretningen kommunikerer omhu og kvalitet"], "emojiMatch": "🍖 antyder kød men billedet viser pasta.", "humanSuggestions": [] }
↑ Lille tekstmismatch → actionNeeded = "rewrite" (kun omskriv tekst, ingen reshoot nødvendig).

EKSEMPEL G – bøf med sauce, teksten nævner "cremet bearnaise" men billedet viser en mørk rød sauce:
{ "contentMatch": { "rating": "fair", "feedback": "Teksten nævner cremet bearnaise, men billedet viser en mørk rød sauce.", "rewriteSuggestion": "🥩 Vores bøf med intens pebersauce — saftig, kraftfuld og lavet med omhu. Kom og smag!", "reshootGuidance": null, "actionNeeded": "rewrite" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "Ret saucebeskrivelsen — ellers er billedet klar til opslag.", "generalFeedback": "Bøffen er flot anrettet og ser saftig og indbydende ud. Den mørke sauce giver billedet dybde og karakter.", "whatWorks": ["Bøffens stegeflade og saft er klar og appetitlig", "Anretningen kommunikerer restaurantkvalitet"], "emojiMatch": null, "humanSuggestions": [] }
↑ Det primære motiv (bøf) matcher — men et navngivet sekundært element (sauce) er forkert beskrevet → rating sænket til "fair", actionNeeded = "rewrite". ALDRIG retake.

EKSEMPEL H — sorbet dessert + rødvin, overskriften er "Forkæl dig selv ved åen" og teksten indeholder "ved åen 🌊", men billedet viser et INDENDØRS restaurantmiljø med sorbet og vin, telefon på bordet:
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten handler om sorbet dessert med rødvin — billedet viser præcis dette.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [{ "id": "remove_phone", "category": "cleaning", "title": "Fjern mobiltelefon", "reason": "Trækker øjet væk fra desserten", "location": "Mobiltelefon på bordet ved siden af skålen", "action": "remove_object" }], "recommendation": "quick-fix", "recommendationText": "Fjern mobiltelefonen — desserten er klar til opslag.", "generalFeedback": "Sorbetens levende farver og varme aftenstemning giver billedet et stærkt visuelt udtryk.", "whatWorks": ["Sorbetens farve er livlig og iøjnefaldende", "Den varme, dæmpede belysning skaber en hyggelig aftenstemning"], "emojiMatch": null, "humanSuggestions": [] }
↑ "Forkæl dig selv ved åen" er overskrift og 🌊 optræder i brødteksten — begge er lokationskontekst, ikke visuelle krav. contentMatch vurderer KUN om dessert + rødvin matcher billedet = excellent. emojiMatch = null fordi 🌊 er en stemningsemoji knyttet til et lokationsord. Uanset at lokationssætningen er overskrift og gentages, er det stadig kontekst.`
    : `Analyze this café ${mediaType === 'video' ? 'video' : 'image'} for social media.

${postText ? `The text says: "${postText}"` : 'No text included.'}
${businessType ? `Business type: ${businessType}` : ''}

Return ONLY valid JSON without markdown or extra text:
{
  "contentMatch": {
    "rating": "excellent|good|fair|poor",
    "feedback": "1-2 sentences in one unbroken line.",
    "rewriteSuggestion": null,
    "reshootGuidance": null,
    "actionNeeded": "none|rewrite|choice"
  },
  "emojiMatch": null,
  "whatWorks": ["Specific positive point, max 12 words", "Another point"],
  "generalFeedback": "2-3 sentences about photographic strengths — no problems.",
  "suggestions": [],
  "humanSuggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Short encouraging sentence, max 15 words"
}

FORMAT: All strings must be continuous WITHOUT line breaks. One object per suggestions entry.
emojiMatch:
  - Emoji contradicts the image → write one sentence, max 15 words. E.g.: "🍖 suggests meat but the image shows pasta."
  - Emoji matches or is neutral → ALWAYS null. E.g.: 🍽️ on an image with food/cutlery → null. 🍷 on an image with wine → null.
  - Atmosphere and location emojis (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 🌅 🌃) represent the business’s MOOD and physical setting — never a visual requirement. Always null. Also when the text contains a matching location word — “by the river 🌊“ → null. Do NOT write a sentence about what is absent.
  ⛔ NEVER write "The emoji matches perfectly" or "The emoji fits X" — this is forbidden. Only null.
humanSuggestions: [] unless the text names a specific food item that is not visible in the image. NEVER generic photo coaching here.
recommendation = "retake" → suggestions MUST be [].
generalFeedback: Strengths only. NEVER name a problem here.
rewriteSuggestion: Concrete rewritten caption in the SAME LANGUAGE as the original text, matching the image content. null if actionNeeded = "none".
reshootGuidance: Brief description of what to photograph to match the original text. null unless actionNeeded = "choice".
actionNeeded: "none" if rating is excellent/good. "rewrite" if rating is fair. "choice" if rating is poor.
recommendationText: STRUCTURE DEPENDS ON RECOMMENDATION LEVEL:
  • "post-it": Encouraging affirmation. E.g.: "Post it! The food looks inviting."
  • "good-enough": Validating statement. E.g.: "A credible restaurant shot ready to post."
  • "quick-fix": Constructive acknowledgment first, then specific improvement. STRUCTURE: "[What's strong] — [specific improvement]". E.g.: "Strong starting point — small improvements will lift it further." or "Good mood — remove the carafe and it's ready."
  • "retake": Empathetic but clear recommendation. E.g.: "The dish is too unclear for a post. Try natural light from the side."
Max 15 words.
⛔ NEVER: "A few adjustments will lift this image." or "With a couple of tweaks this is ready." — these are too generic and are forbidden.

SUGGESTION FORMAT:
{ "id": "unique_id", "category": "cleaning|color", "title": "Max 6 words", "reason": "Max 12 words", "location": "Precise spatial description with proportional framing, e.g. 'upper-left quarter of the frame', 'bottom-right corner approx. 15% of image', or relative to hero subject: 'directly left of the dish'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }

ACTION↔CATEGORY (NEVER cross):
  remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
  adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

EXAMPLE A – clearly good image, text and image match:
{ "contentMatch": { "rating": "excellent", "feedback": "The text and image match perfectly.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "post-it", "recommendationText": "Post it! The food looks inviting.", "generalFeedback": "The dish dominates the frame with great texture and warm lighting. It communicates quality and authenticity.", "whatWorks": ["Warm side light highlights the texture of the dish", "Clean composition with clear focus on the hero subject"], "emojiMatch": null, "humanSuggestions": [] }

EXAMPLE B – steak with dim lighting, bokeh, wine glass — good atmosphere, NOT retake, text matches:
{ "contentMatch": { "rating": "excellent", "feedback": "The image and text match.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "A credible restaurant shot ready to post.", "generalFeedback": "The steak is sharp and clearly visible with beautiful fat marbling. The warm, dim lighting is a strength.", "whatWorks": ["The steak's fat marbling is clear and appetising", "Bokeh background supports the restaurant atmosphere"], "emojiMatch": null, "humanSuggestions": [] }

EXAMPLE C – usable image with one foreign object (water carafe):
{ "contentMatch": { "rating": "excellent", "feedback": "The text and image are in good alignment.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [{ "id": "remove_carafe", "category": "cleaning", "title": "Remove water carafe", "reason": "Pulls the eye away from the dish", "location": "Water carafe to the left of the dish", "action": "remove_object" }], "recommendation": "quick-fix", "recommendationText": "Good plating — remove the carafe and it's ready.", "generalFeedback": "The dish colours and plating are inviting and well-prepared.", "whatWorks": ["Plating is clear and appetising", "Light enhances the dish colours naturally"], "emojiMatch": null, "humanSuggestions": [] }

EXAMPLE D – dish is genuinely unidentifiable (technical flaw — this is retake):
{ "contentMatch": { "rating": "good", "feedback": "The description matches what is being shown.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [], "recommendation": "retake", "recommendationText": "The dish is too unclear to post. Try natural side light from a window.", "generalFeedback": "The image is taken with passion and intention. The atmosphere is there — but the technical execution needs another attempt.", "whatWorks": ["Table setting and serving look carefully done"], "emojiMatch": null, "humanSuggestions": [] }

EXAMPLE E – good dessert (clear, colourful sorbet), but text is about steak — retake is BLOCKED, user offered choice:
{ "contentMatch": { "rating": "poor", "feedback": "The text describes steak but the image shows dessert.", "rewriteSuggestion": "🍨 Our sorbet is the star of the season — fresh, vibrant and made with love. Come taste it!", "reshootGuidance": "Photograph a steak or meat dish with appropriate plating and lighting.", "actionNeeded": "choice" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "An inviting image — just update the text.", "generalFeedback": "The dessert's vivid colours and clear plating give the image a strong visual impact.", "whatWorks": ["The sorbet colour is vibrant and eye-catching", "The plating is clear and inviting"], "emojiMatch": null, "humanSuggestions": [] }
↑ Photo is technically good → NEVER retake. contentMatch.poor → actionNeeded = "choice" (rewrite text OR reshoot).

EXAMPLE F – good dish, but caption is slightly off (wrong emoji, minor mismatch):
{ "contentMatch": { "rating": "fair", "feedback": "The 🍖 emoji suggests meat but the image shows pasta.", "rewriteSuggestion": "🍝 Our homemade pasta — a classic that always hits the spot. Come and taste!", "reshootGuidance": null, "actionNeeded": "rewrite" }, "suggestions": [], "recommendation": "post-it", "recommendationText": "Post it! Just fix the emoji in your text.", "generalFeedback": "The pasta colours and plating are inviting and well-presented.", "whatWorks": ["The dish colours are clear and appetising", "The plating communicates care and quality"], "emojiMatch": "🍖 suggests meat but the image shows pasta.", "humanSuggestions": [] }
↑ Minor text mismatch → actionNeeded = "rewrite" (just fix the text, no reshoot needed).

EXAMPLE G – steak with sauce, text mentions "creamy béarnaise" but image shows a dark red sauce:
{ "contentMatch": { "rating": "fair", "feedback": "The text mentions creamy béarnaise but the image shows a dark red sauce.", "rewriteSuggestion": "🥩 Our steak with a rich pepper sauce — juicy, bold and made with care. Come taste it!", "reshootGuidance": null, "actionNeeded": "rewrite" }, "suggestions": [], "recommendation": "good-enough", "recommendationText": "Update the sauce description and this shot is ready to post.", "generalFeedback": "The steak is beautifully plated and looks juicy and inviting. The dark sauce adds depth and character.", "whatWorks": ["The steak's seared surface and juices are clear and appetising", "The plating communicates restaurant quality"], "emojiMatch": null, "humanSuggestions": [] }
↑ Primary subject (steak) matches — but a named secondary element (sauce) is wrongly described → rating lowered to "fair", actionNeeded = "rewrite". NEVER retake.

EXAMPLE H — sorbet dessert + red wine, headline is "Treat yourself by the river" and text contains "by the river 🌊", but image shows an INDOOR restaurant setting with sorbet and wine, phone on the table:
{ "contentMatch": { "rating": "excellent", "feedback": "The text is about sorbet dessert with red wine — the image shows exactly this.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "suggestions": [{ "id": "remove_phone", "category": "cleaning", "title": "Remove phone", "reason": "Pulls the eye away from the dessert", "location": "Phone on the table next to the bowl", "action": "remove_object" }], "recommendation": "quick-fix", "recommendationText": "Remove the phone and this shot is ready to post.", "generalFeedback": "The sorbet's vivid colours and warm evening atmosphere give the image strong visual impact.", "whatWorks": ["The sorbet colour is vivid and eye-catching", "Warm dim lighting creates a welcoming atmosphere"], "emojiMatch": null, "humanSuggestions": [] }
↑ "Treat yourself by the river" is the headline and 🌊 appears in the body — both are location context, not visual requirements. contentMatch evaluates ONLY whether dessert + red wine matches the image = excellent. emojiMatch = null because 🌊 is an atmosphere emoji tied to a location word. Location phrases as headlines are still location context, never visual claims.`

  return { systemPrompt, userPrompt }
}

// ── SIMPLE / TEST PROMPT ─────────────────────────────────────────────────────
// Activate: set Supabase secret  PROMPT_VERSION=simple  (no redeploy needed)
// Deactivate: remove or unset the secret to return to the full prompt.
//
// Previous version of this prompt is preserved below as buildSimplePromptV1().
// Same return shape as buildPaidPrompt — drop-in replacement.

export async function buildSimplePrompt(
  language: string,
  { postText, businessType, imageWidth, imageHeight }: PaidPromptParams = {}
): Promise<{ systemPrompt: string; userPrompt: string }> {

  // Load language-specific system opener and closer
  const lang = language as Language
  const result = await loadLanguageConfig(lang, 'photo-analysis-simple-system')
  
  let systemOpener: string
  let systemCloser: string
  
  if (!result.success || !result.prompt) {
    console.warn(`Failed to load ${lang} photo-analysis-simple system prompt, using inline version`)
    systemOpener = language === 'da'
      ? 'Du vurderer et foto til sociale medier for en lokal virksomhed i food & beverage branchen (café, restaurant, bar, kaffebar, vinbar, takeaway eller bageri).\n\nSvar kort, konkret og handlingsorienteret. Undgå teknisk fotosprog.\n\nMålet er at hjælpe en travl ejer med at forstå:\n• om fotoet er godt nok til opslag\n• hvad der hurtigt kan forbedres\n• om det er bedre at tage et nyt foto'
      : 'You are evaluating a photo for social media for a local food & beverage business (café, restaurant, bar, coffee shop, wine bar, takeaway or bakery).\n\nKeep responses concise, specific and action-oriented. Avoid technical photography jargon.\n\nThe goal is to help a busy owner understand:\n• whether the photo is good enough to post\n• what can be quickly improved\n• whether it\'s better to take a new photo'
    systemCloser = ''
  } else {
    systemOpener = result.prompt.system
    systemCloser = result.prompt.closer
  }

  const systemPrompt = language === 'da'
    ? `${systemOpener}

⚠️ VIGTIG INSTRUKTION:
Du skal vurdere FOTO-KVALITET til sociale medier.
Du skal IKKE lave objekt-detektion.
Du skal IKKE returnere bounding boxes.
Du skal IKKE returnere koordinater eller labels.

Din opgave er KUN at bedømme om fotoet er godt nok til et opslag.

---

Svar kort, konkret og handlingsorienteret. Undgå teknisk fotosprog.

Målet er at hjælpe en travl ejer med at forstå:
• om fotoet er godt nok til opslag
• hvad der hurtigt kan forbedres
• om det er bedre at tage et nyt foto

---

VURDER FOTOET UD FRA:

1. Stop-effekt (fanger billedet opmærksomhed i feed?)
2. Appetit og stemning (ser mad/drikke fristende ud?)
3. Klarhed i motiv (ét tydeligt fokus)
4. Lys og farver (naturligt og indbydende)
5. Komposition og beskæring (tæt nok på motivet, rolig baggrund)
6. Autenticitet (ægte og lokalt – ikke stock)
7. Liv og følelse (hænder, mennesker, damp, tekstur, bevægelse)
8. Mobilvisning og SoMe-egnethed

---

KLASSIFICÉR FUND INTERNT:

KRITISK problem (nyt foto anbefales), fx:
• motiv uklart eller for langt væk
• meget mørkt, fladt eller overeksponeret
• sløret / ude af fokus
• rodet baggrund der dominerer
• uappetitlige farver der ikke kan fixes hurtigt
• manglende stemning eller autenticitet

HURTIG FIX (kan løses hurtigt), fx:
• lettere beskæring
• lidt mere lys eller varmere tone
• mindre distraktion i baggrund
• tydelige ikke relevante elementer eller ting
• motiv lidt for langt væk
• mindre farvejustering

---

BESLUTNINGSLOGIK:

• Hvis mindst 1 KRITISK → retake
• Hvis 0 KRITISKE og 1 HURTIG FIX → good-enough
• Hvis 0 KRITISKE og 2–3 HURTIGE FIX → quick-fix
• Hvis >3 HURTIGE FIX → retake
• Hvis ingen problemer → post-it

Brug 30-sekunders-reglen kun hvis du er i tvivl mellem quick-fix og retake.

---

EMOJI MATCH:
Vurdér KUN mad- og drikke-emojis (🍕 🍔 ☕ 🍷 🥩 osv.) — kun hvis de modsiger billedet (f.eks. 🍖 men billedet viser pasta). Sæt emojiMatch = null hvis emojien passer eller er neutral.
Stemnings- og lokationsemojier (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 osv.) er aldrig visuelle krav — sæt altid emojiMatch = null for disse.
Ignorér aldrigé svar med "Emoji matches" eller "Emoji er synlig" — kun null.

CONTENT MATCH:
Ignorér emojis og vurder om teksten matcher billedet.
Lokationsætninger ("ved åen", "ved udeserveringen" osv.) er stedsbeskrivelse — ikke visuelle krav til billedet.

---

Tone ved retake skal altid være tryg og opmuntrende.

${systemCloser}`
    : `${systemOpener}

⚠️ CRITICAL INSTRUCTION:
You are evaluating PHOTO QUALITY for social media.
You are NOT performing object detection.
Do NOT return bounding boxes.
Do NOT return coordinates or labels.

Your task is ONLY to assess if the photo is good enough to post.

---

Respond concisely and action-oriented. Avoid technical photography jargon.

Evaluate based on stop power, appetite, subject clarity, light, composition, authenticity, life, and mobile suitability.

Classify findings internally as CRITICAL (requires retake) or QUICK FIX (easy improvement).

Decision logic:
• ≥1 CRITICAL → retake
• 1 QUICK FIX → good-enough
• 2–3 QUICK FIX → quick-fix
• >3 QUICK FIX → retake
• none → post-it

Use the 30-second rule only when unsure.

EMOJI MATCH: Only flag food/drink emojis (🍕 🍔 ☕ 🍷 🥩 etc.) if they contradict the image (e.g. 🍖 but image shows pasta). Set emojiMatch = null if the emoji fits or is neutral.
Atmosphere and location emojis (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 etc.) are never visual requirements — always null.
NEVER write "emoji matches" or "emoji is visible" — only null.
CONTENT MATCH: Ignore emojis. Location phrases ("by the river", "on the terrace" etc.) are setting context — not visual requirements.

Retake tone must be warm and encouraging.

${systemCloser}`

  const userPrompt = language === 'da'
    ? `Analyser dette foto til sociale medier.

${postText ? `Teksten siger: "${postText}"` : 'Ingen tekst inkluderet.'}
${businessType ? `Virksomhedstype: ${businessType}` : ''}

⚠️ OUTPUT FORMAT - OBLIGATORISK:
Returner KUN valid JSON som et OBJEKT (starter med {, IKKE [).
Ingen markdown.
Ingen bounding boxes.
Ingen objekt-detektion.

Alle felter SKAL altid være til stede.

KREVET FORMAT (kopier denne struktur nøjagtigt):
{
  "contentMatch": { "rating": "excellent|good|fair|poor", "feedback": "1-2 sætninger i én ubrudt linje." },
  "emojiMatch": null,
  "whatWorks": ["maks 12 ord", "maks 12 ord"],
  "generalFeedback": "2-3 sætninger i én ubrudt linje.",
  "suggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "kort sætning maks 15 ord"
}

RETURNER IKKE:
- Arrays med bounding boxes
- Objekt-koordinater
- Labels eller detections
- Andre formater end ovenstående

FORMATREGLER:
• Ingen linjeskift inde i strengfelter
• Ingen bullets inde i strengfelter
• emojiMatch: null hvis ingen mismatch. Kun en sætning hvis en mad/drikke-emoji modsiger billedet. Stemningsemojier (🌊 ☀️ 🌿 osv.) → altid null. Skriv ALDRIG "emoji passer" eller "emoji er synlig".

SUGGESTIONS:
• good-enough → maks 1 forslag
• quick-fix → maks 3 forslag
• retake og post-it → []

SUGGESTION FORMAT:
{ "id": "unik_id", "category": "cleaning|color", "title": "maks 6 ord", "reason": "maks 12 ord", "location": "kort tekst", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }`
    : `Analyse this photo for social media.

${postText ? `The text says: "${postText}"` : 'No text included.'}
${businessType ? `Business type: ${businessType}` : ''}

⚠️ OUTPUT FORMAT - REQUIRED:
Return ONLY valid JSON as an OBJECT (starts with {, NOT [).
No markdown.
No bounding boxes.
No object detection.

All fields must always be present.

REQUIRED FORMAT (copy this structure exactly):
{
  "contentMatch": { "rating": "excellent|good|fair|poor", "feedback": "1-2 sentences in one line." },
  "emojiMatch": null,
  "whatWorks": ["max 12 words", "max 12 words"],
  "generalFeedback": "2-3 sentences in one line.",
  "suggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "short sentence max 15 words"
}

No line breaks inside strings.
emojiMatch: null if no mismatch. Only a sentence if a food/drink emoji contradicts the image. Atmosphere emojis (🌊 ☀️ 🌿 etc.) → always null. NEVER write "emoji matches" or "emoji is visible".

Suggestions:
• good-enough → max 1
• quick-fix → max 3
• retake and post-it → []

Use the defined suggestion structure.`

  return { systemPrompt, userPrompt }
}

// ── TWO-CALL SPLIT: CALL 1 (Assessment) ─────────────────────────────────────
// Identical reasoning to buildPaidPrompt but AI suggestions stripped out.
// Call 2 (below) handles suggestion generation with Call 1 context as input.

export async function buildCall1Prompt(
  language: string,
  { postText, businessType, imageWidth, imageHeight, mediaType }: PaidPromptParams = {}
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const videoNoteDA = mediaType === 'video'
    ? `\n\nVIGTIGT: DETTE ER EN VIDEO, IKKE ET STILLBILLEDE.\n— Brug "videoen"/"videoklippet" i stedet for "billedet" i ALLE outputfelter.\n— Evaluer videoen på stemning, indhold og tekstmatch, præcis som du ville et billede.`
    : ''
  const videoNoteEN = mediaType === 'video'
    ? `\n\nIMPORTANT: THIS IS A VIDEO, NOT A STILL IMAGE.\n— Use "the video"/"the footage" instead of "the image" in ALL output fields.\n— Evaluate the video on atmosphere, content and text match, exactly as you would an image.`
    : ''

  // Load language-specific system opener and closer
  const lang = language as Language
  const result = await loadLanguageConfig(lang, 'photo-analysis-call1-system')
  
  let systemOpener: string
  let systemCloser: string
  
  if (!result.success || !result.prompt) {
    console.warn(`Failed to load ${lang} photo-analysis-call1 system prompt, using inline version`)
    systemOpener = language === 'da'
      ? 'Du er en social media-rådgiver for lokale caféer og restauranter.\nDin opgave er at vurdere om et foto er godt nok til et opslag på sociale medier.\nDin standard er ikke professionelt fotografering — din standard er: ville ejeren af en travl lokal café eller restaurant være tryg ved at poste dette billede i dag?'
      : 'You are a social media advisor for local cafés and restaurants.\nYour job is to assess whether a photo is good enough to post on social media.\nYour standard is not professional photography — your standard is: would the owner of a busy local café or restaurant feel comfortable posting this image today?'
    systemCloser = ''
  } else {
    systemOpener = result.prompt.system
    systemCloser = result.prompt.closer
  }

  const systemPrompt = language === 'da'
    ? `${systemOpener}${videoNoteDA}

════ GENNEMGANG I TO ADSKILTE PAS ════

PAS 1 — BILLEDKVALITET (ignorer teksten fuldstændigt i dette pas):

TRIN 1 — FULDT SCENEOVERBLIK. Beskriv det du ser, inden du bedømmer noget:
① Hvad er HELTEMOTIVET? Det kan være en ret, en drik, en anretning, en person, en stemning eller et miljø — det der bærer billedets budskab.
② Er heltemotivet tydeligt identificerbart og virker det indbydende eller engagerende? Skriv dette som din første whatWorks-observation.
③ Hvilke ikke-helte-elementer er synlige? Gennemgå hele billedet: genstande på bordet, pletter på servering, baggrundselementer, farveproblemer. Pletter, smuds og mærker på serveringsfade SKAL listes som selvstændige punkter — de slås IKKE sammen med et redskab eller anden genstand i samme zone.

TRIN 2 — KVALIFIKATIONSTEST (køres på hvert ikke-helte-element fra Trin 1):
For hvert element: ville en seer bemærke det FØR eller SAMTIDIG med heltemotivet, OG reducerer det appetitten, oplevelsen eller første-indtryk? Ja på begge → kandidat. Nej på én → scene-kontekst, ignorer.
Serveringsredskaber der hører direkte til retten (dessertske med dessertskål, steakkniv ved siden af bøffen, pastafork ved pasta) er altid scene-kontekst — aldrig kandidater, uanset placering eller synlighed.
Vinglas, borddækning, dæmpet lys og bokeh vil næsten altid fejle anden del af testen — de forstærker oplevelsen.

TRIN 3 — KRYDSTJEK OG RECOMMENDATION:
Baseret på Trin 1 og 2:
- Kandidatlisten ikke tom → recommendation = "quick-fix"
- Ingen kandidater, heltemotivet er stærkt → recommendation = "post-it" eller "good-enough"
- Heltemotivet er genuint uidentificerbart pga. en teknisk fejl (ikke mørk stemning, ikke rod) → recommendation = "retake"

retake kræver en TEKNISK BILLEDFEJL. Dæmpet restaurantlys, rod på bordet og genstande på bordet er ikke tekniske fejl. Tekst-mismatch er ALDRIG en grund til retake.

PAS 2 — TEKSTMATCH (evaluer KUN tekst mod billedets faktiske indhold fra Pas 1):
TRIN 4 — Hvad er tekstens kerneemne? Hvad er billedets kerneindhold (bestemt i Pas 1)?
LOKATIONSREGEL: Sætninger der beskriver HVOR maden nydes ("ved åen", "ved udeserveringen", "i gården", "under åben himmel", restaurantnavne med stedord) er kontekst om stedets placering — de er IKKE visuelle krav til billedet. Billedet behøver ikke vise åen, udeserveringen eller stedet. Ignorer disse fuldstændigt. Positionen af lokationssætningen i teksten er irrelevant — om den optræder som overskrift, første sætning eller gentages i brødteksten gør ingen forskel. "Forkæl dig selv ved åen" som overskrift er stadig lokationskontekst, ikke et visuelt krav.
Når en lokationsætning OG en stemningsemoji (🌊, 🌿, ☀️ osv.) optrer sammen i teksten — f.eks. "ved åen 🌊" — ignoreres begge. De forstærker ikke hinanden som visuelle krav. contentMatch skal UDELUKKENDE vurdere om madens/produktets kerneindhold matcher billedet.
TRIN 4b — Nævner teksten specifikke saucer, tilbehør eller sekundære madelementer (f.eks. "cremet bearnaise", "karamelliserede løg", "frisk guacamole")? Gennemgå hvert navngivet element: Er det synligt og visuelt præcist beskrevet i billedet? Hvis et navngivet sekundært element TYDELIGT er erstattet af noget andet (anden saucetype, anden farve, forkert tilbehør) → sænk rating ét niveau og anfør uoverensstemmelsen præcist i feedback.
TRIN 5 — Fastsæt contentMatch.rating og contentMatch.feedback.
Rating baseres UDELUKKENDE på om madens/produktets kerneidentitet i teksten matcher det visuelle kerneindhold i billedet.
Lokation, stemning, atmosfære og restaurantens fysiske miljø må ALDRIG sænke ratingen eller nævnes i feedback. Feedback-sætningen må KUN handle om mad/produkt-matchet.
TRIN 6 — Hvis rating er "fair": skriv rewriteSuggestion. Sæt actionNeeded = "rewrite".
          Hvis rating er "poor": skriv rewriteSuggestion OG reshootGuidance. Sæt actionNeeded = "choice".
          Hvis rating er "excellent" eller "good": sæt actionNeeded = "none". rewriteSuggestion = null. reshootGuidance = null.

rewriteSuggestion = en konkret omskrevet version af brugerens tekst så den passer til billedet. Samme tone og sprog som originalteksten. KUN tekstrådgivning — aldrig fotorådgivning.
reshootGuidance = kort beskrivelse af hvilket foto der ville matche den originale tekst. KUN når actionNeeded = "choice".

GENERALFEEDBACK:
Kun fotografiske styrker. Skriv aldrig et problem her — heller ikke som forbehold eller "men".
Bland aldrig contentMatch eller emojiMatch ind her.

KALIBRERINGS-EKSEMPLER:
Eks 1 — bøf, dæmpet lys, bokeh, vinglas: recommendation = "good-enough", contentMatch.actionNeeded = "none".
Eks 2 — ret med telefon på bordet: recommendation = "quick-fix", contentMatch.actionNeeded = "none". De specifikke AI-forslag returneres separat.
Eks 3 — kaffe, ren baggrund: recommendation = "post-it".
Eks 4 — ret genuint ude af fokus: recommendation = "retake".
Eks 5 — god dessert + bøftekst: recommendation = "good-enough", contentMatch.rating = "poor", actionNeeded = "choice", rewriteSuggestion = omskrevet tekst om dessert, reshootGuidance = "Fotografer en bøf...". ALDRIG retake.
Eks 6 — god rettebillede + let misvisende caption (forkert emoji): recommendation = "post-it" eller "good-enough", contentMatch.rating = "fair", actionNeeded = "rewrite", rewriteSuggestion = rettet caption. ALDRIG retake.
Eks 7 — levende farvet dessert i skål, telefon på bordet: recommendation = "quick-fix". ALDRIG retake — retten er synlig og indbydende; telefon kan fjernes. De specifikke AI-forslag returneres separat.
Eks 8 — dessert + rødvin i tekst, teksten nævner "Forkæl dig selv ved åen" og indeholder 🌊, men billedet viser indendørs bordmiljø med sorbet og vin: contentMatch.rating = "excellent", feedback = "Teksten handler om sorbet dessert med rødvin — billedet viser netop dette.", rewriteSuggestion = null, actionNeeded = "none". emojiMatch = null. Lokation og 🌊 er stedskontekst og må aldrig nævnes i hverken contentMatch eller emojiMatch.`
    : `You are a social media advisor for local cafés and restaurants.
Your job is to assess whether a photo is good enough to post on social media.
Your standard is not professional photography — your standard is: would the owner of a busy local café or restaurant feel comfortable posting this image today?${videoNoteEN}

════ TWO-PASS EVALUATION ════

PASS 1 — PHOTO QUALITY (ignore the text completely in this pass):

STEP 1 — FULL SCENE INVENTORY. Observe before evaluating:
① What is the HERO SUBJECT? It can be a dish, a drink, a plating, a person, an atmosphere, or an environment — whatever carries the image's message.
② Is the hero subject clearly identifiable and does it feel inviting or engaging? Write this as your first whatWorks observation.
③ What non-hero elements are visible? Scan the entire frame: objects on the table, marks on the serving, background elements, colour issues. Marks, smudges, and stains on serving dishes MUST be listed as independent items — they are NEVER merged with a utensil or other object occupying the same zone.

STEP 2 — QUALIFICATION TEST (apply to each non-hero element from Step 1):
For each element: would a viewer notice it BEFORE or AT THE SAME TIME as the hero subject, AND does it reduce appetite, the experience, or first impression? Yes to both → candidate. No to either → scene context, ignore.
Serving utensils that belong directly to the dish (dessert spoon with a dessert bowl, steak knife next to a steak, pasta fork with pasta) are always scene context — never candidates, regardless of placement or visibility.
Wine glasses, table setting, dim lighting, and bokeh will almost always fail the second part of the test — they reinforce the experience.

STEP 3 — CROSS-CHECK AND RECOMMENDATION:
Based on Steps 1 and 2:
- Candidate list is not empty → recommendation = "quick-fix"
- No candidates, hero is strong → recommendation = "post-it" or "good-enough"
- Hero subject is genuinely unidentifiable due to a technical flaw (not dim atmosphere, not clutter) → recommendation = "retake"

retake requires a TECHNICAL IMAGE FLAW. Dim restaurant lighting, clutter on the table, and objects on the table are not technical flaws. Text mismatch is NEVER a reason for retake.

PASS 2 — TEXT FIT (evaluate ONLY the text against the photo's actual content from Pass 1):
STEP 4 — What is the core subject of the text? What is the core content of the image (determined in Pass 1)?
LOCATION RULE: Phrases describing WHERE the food is enjoyed ("by the river", "on the terrace", "in the courtyard", "under the open sky", restaurant names with location words) are context about the business's physical location — they are NOT visual requirements for the photo. The image does not need to show the river, terrace, or location. Ignore these completely. The position of the location phrase in the text is irrelevant — whether it appears as the headline, the first sentence, or repeated in the body makes no difference. "Treat yourself by the river" as a headline is still location context, not a visual claim.
When a location phrase AND an atmosphere emoji (🌊, 🌿, ☀️ etc.) appear together in the same text — e.g. "by the river 🌊" — both are still ignored. They do not reinforce each other as visual requirements. contentMatch must ONLY evaluate whether the food/product's core content matches the image.
STEP 4b — Does the text name specific sauces, sides, or secondary food elements (e.g. "creamy béarnaise", "caramelised onions", "fresh guacamole")? For each named element: is it visibly present and accurately described in the image? If a named secondary element is CLEARLY replaced by something different (different sauce type, different colour, wrong side) → lower the rating one level and state the discrepancy precisely in feedback.
STEP 5 — Set contentMatch.rating and contentMatch.feedback.
Rating is based SOLELY on whether the food/product core identity in the text matches the visual core content of the image.
Location, atmosphere, mood, and the restaurant's physical setting must NEVER lower the rating or appear in feedback. The feedback sentence may ONLY describe the food/product match.
STEP 6 — If rating is "fair": write rewriteSuggestion. Set actionNeeded = "rewrite".
          If rating is "poor": write rewriteSuggestion AND reshootGuidance. Set actionNeeded = "choice".
          If rating is "excellent" or "good": set actionNeeded = "none". rewriteSuggestion = null. reshootGuidance = null.

rewriteSuggestion = a concrete rewritten version of the user's text to match the image. Same tone and language as the original. Text advice ONLY — never photo advice.
reshootGuidance = brief description of what photo would match the original text. ONLY when actionNeeded = "choice".

GENERALFEEDBACK:
Strengths only. Never name a problem here — not even as a qualification or a "but".
Never mix contentMatch or emojiMatch findings into generalFeedback.

CALIBRATION EXAMPLES:
Ex 1 — steak, dim light, bokeh, wine glass: recommendation = "good-enough", contentMatch.actionNeeded = "none".
Ex 2 — dish with phone on table: recommendation = "quick-fix", contentMatch.actionNeeded = "none". Specific AI suggestions are returned separately.
Ex 3 — coffee, clean background: recommendation = "post-it".
Ex 4 — dish genuinely out of focus: recommendation = "retake".
Ex 5 — good dessert + steak text: recommendation = "good-enough", contentMatch.rating = "poor", actionNeeded = "choice", rewriteSuggestion = rewritten text about dessert, reshootGuidance = "Photograph a steak...". NEVER retake.
Ex 6 — good dish + slightly off caption (wrong emoji): recommendation = "post-it" or "good-enough", contentMatch.rating = "fair", actionNeeded = "rewrite", rewriteSuggestion = corrected caption. NEVER retake.
Ex 7 — vivid-coloured dessert in a bowl, phone on the table: recommendation = "quick-fix". NEVER retake — the dish is visible and inviting. Specific AI suggestions are returned separately.
Ex 8 — sorbet dessert + red wine, headline is "Treat yourself by the river" and text contains 🌊, but image shows an indoor table setting: contentMatch.rating = "excellent", feedback = "The text is about sorbet dessert with red wine — the image shows exactly this.", rewriteSuggestion = null, actionNeeded = "none". emojiMatch = null. Location and 🌊 are setting context and must never appear in either contentMatch or emojiMatch.`

  const userPrompt = language === 'da'
    ? `Analyser dette café-${mediaType === 'video' ? 'video' : 'billede'} til social media.

${postText ? `Teksten siger: "${postText}"` : 'Ingen tekst inkluderet.'}
${businessType ? `Virksomhedstype: ${businessType}` : ''}

Returner KUN valid JSON uden markdown eller ekstra tekst.
AI-forslag returneres i et separat trin — inkludér IKKE et suggestions-felt her.

{
  "contentMatch": {
    "rating": "excellent|good|fair|poor",
    "feedback": "1-2 sætninger i én ubrudt linje.",
    "rewriteSuggestion": null,
    "reshootGuidance": null,
    "actionNeeded": "none|rewrite|choice"
  },
  "emojiMatch": null,
  "whatWorks": ["Specifikt positivt punkt, maks 12 ord", "Endnu et punkt"],
  "generalFeedback": "2-3 sætninger om fotografiske styrker — ingen problemer.",
  "humanSuggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Kort opmuntrende sætning, maks 15 ord"
}

FORMAT: Alle strenge skal være kontinuerlige UDEN linjeskift.
emojiMatch:
  - Emoji modsiger billedet → skriv én sætning, maks 15 ord. Eks: "🍖 antyder kød men billedet viser pasta."
  - Emoji passer eller er neutral → ALTID null.
  - Stemnings- og lokationsemojier (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 🌅 🌃) repræsenterer STEMNING og stedets placering — aldrig et visuelt krav. Altid null. Også når teksten indeholder et tilsvarende lokationsord — "ved åen 🌊" → null.
  ⛔ ALDRIG skrive "Emoji'en passer perfekt" eller "Emoji'en matcher X" — kun null.
humanSuggestions: [] medmindre teksten nævner et specifikt navngivet madelement der ikke er synligt. ALDRIG generisk fotofeedback her.
recommendation = "retake" → ingen AI-forslag følger (tomme i efterfølgende trin).
generalFeedback: KUN fotografiske styrker. Nævn ALDRIG et problem her.
rewriteSuggestion: Konkret omskrevet caption på SAMME SPROG som teksten. null hvis actionNeeded = "none".
reshootGuidance: null medmindre actionNeeded = "choice".
actionNeeded: "none" hvis rating excellent/good. "rewrite" hvis rating fair. "choice" hvis rating poor.
recommendationText: Skal referere til den vigtigste konkrete rettelse ved navn — aldrig en generisk formulering. Eks: "Fjern vandkaraffen — billedet er opdagsklar." eller "Varm farvetonerne lidt op, og retten springer ud." Maks 15 ord.
⛔ ALDRIG: "Små justeringer vil løfte billedet." eller "Med et par rettelser er billedet klar." — disse er for generiske og forbudne.

EKSEMPEL A – klart godt billede, tekst og billede matcher:
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten og billedet matcher perfekt.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Varm sidelysning fremhæver rettens tekstur", "Rent komposition med klar fokus på heltemotivet"], "generalFeedback": "Retten dominerer billedet med flot tekstur og varm belysning.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "post-it", "recommendationText": "Post det! Maden ser indbydende ud." }

EKSEMPEL B – bøf, dæmpet lys, bokeh, vinglas:
{ "contentMatch": { "rating": "excellent", "feedback": "Billedet og teksten matcher.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Bøffens fedtmarmorering er klar og appetitvækkende", "Bokeh-baggrunden understøtter restaurantstemningen"], "generalFeedback": "Bøffen er tydelig og skarp med smukt fremhævet fedtmarmorering.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "Et troværdigt restaurantbillede klar til opslag." }

EKSEMPEL C – brugbart billede med ét fremmed objekt (vandkaraffel):
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten og billedet er i god overensstemmelse.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Anretningen er klar og appetitvækkende", "Lyset fremhæver rettens farver naturligt"], "generalFeedback": "Rettens farver og anretning er indbydende og veltilberedt.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "quick-fix", "recommendationText": "Fjern vandkaraffen, og billedet er opdagsklar." }
↑ recommendation = "quick-fix" fordi vandkaraflen er en fjernbar kandidat. Det specifikke AI-forslag returneres separat.

EKSEMPEL D – retten er genuint uidentificerbar (teknisk fejl):
{ "contentMatch": { "rating": "good", "feedback": "Beskrivelsen matcher hvad der forsøges vist.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Borddækning og servering ser omhyggelig ud"], "generalFeedback": "Billedet er taget med engagement. Stemningen er der — men den tekniske udførelse kræver endnu et forsøg.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "retake", "recommendationText": "Retten er for uklar til et opslag. Prøv med naturligt lys fra siden." }

EKSEMPEL E – god dessert, men teksten handler om bøf:
{ "contentMatch": { "rating": "poor", "feedback": "Teksten beskriver bøf men billedet viser dessert.", "rewriteSuggestion": "🍨 Vores sorbet er efterårets stjerne — frisk, farverig og lavet med kærlighed. Kom og smag!", "reshootGuidance": "Fotografer en bøf eller et kødret med passende anretning og belysning.", "actionNeeded": "choice" }, "whatWorks": ["Sorbetens farve er livlig og iøjnefaldende", "Anretningen er klar og indbydende"], "generalFeedback": "Dessertens levende farver og klare anretning giver billedet et stærkt visuelt udtryk.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "Et indbydende billede — teksten skal blot opdateres." }

EKSEMPEL F – god ret, caption med forkert emoji:
{ "contentMatch": { "rating": "fair", "feedback": "🍖-emojien antyder kød men billedet viser pasta.", "rewriteSuggestion": "🍝 Vores hjemmelavede pasta — en klassiker der altid varmer. Kom og smag!", "reshootGuidance": null, "actionNeeded": "rewrite" }, "whatWorks": ["Rettens farver er klare og appetitlige", "Anretningen kommunikerer omhu og kvalitet"], "generalFeedback": "Pastaens farver og anretning er indbydende og velfremstillet.", "emojiMatch": "🍖 antyder kød men billedet viser pasta.", "humanSuggestions": [], "recommendation": "post-it", "recommendationText": "Post det! Ret blot emojien i teksten." }

EKSEMPEL G – bøf med sauce, teksten nævner "cremet bearnaise" men billedet viser mørk rød sauce:
{ "contentMatch": { "rating": "fair", "feedback": "Teksten nævner cremet bearnaise, men billedet viser en mørk rød sauce.", "rewriteSuggestion": "🥩 Vores bøf med intens pebersauce — saftig, kraftfuld og lavet med omhu.", "reshootGuidance": null, "actionNeeded": "rewrite" }, "whatWorks": ["Bøffens stegeflade og saft er klar og appetitlig", "Anretningen kommunikerer restaurantkvalitet"], "generalFeedback": "Bøffen er flot anrettet og ser saftig og indbydende ud.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "Ret saucebeskrivelsen — ellers er billedet klar til opslag." }

EKSEMPEL H — sorbet + rødvin, overskriften er "Forkæl dig selv ved åen", 🌊 i teksten, INDENDØRS billede, telefon på bordet:
{ "contentMatch": { "rating": "excellent", "feedback": "Teksten handler om sorbet dessert med rødvin — billedet viser præcis dette.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Sorbetens farve er livlig og iøjnefaldende", "Den varme, dæmpede belysning skaber en hyggelig aftenstemning"], "generalFeedback": "Sorbetens levende farver og varme aftenstemning giver billedet et stærkt visuelt udtryk.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "quick-fix", "recommendationText": "Fjern mobiltelefonen — desserten er klar til opslag." }
↑ contentMatch = excellent (lokation og 🌊 ignoreres). recommendation = "quick-fix" (telefon er kandidat). AI-forslag returneres separat.

${systemCloser}`
    : `${systemOpener}${videoNoteEN}

${postText ? `The text says: "${postText}"` : 'No text included.'}
${businessType ? `Business type: ${businessType}` : ''}

Return ONLY valid JSON without markdown or extra text.
AI suggestions are returned in a separate step — do NOT include a suggestions field here.

{
  "contentMatch": {
    "rating": "excellent|good|fair|poor",
    "feedback": "1-2 sentences in one unbroken line.",
    "rewriteSuggestion": null,
    "reshootGuidance": null,
    "actionNeeded": "none|rewrite|choice"
  },
  "emojiMatch": null,
  "whatWorks": ["Specific positive point, max 12 words", "Another point"],
  "generalFeedback": "2-3 sentences about photographic strengths — no problems.",
  "humanSuggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Short encouraging sentence, max 15 words"
}

FORMAT: All strings must be continuous WITHOUT line breaks.
emojiMatch:
  - Emoji contradicts the image → write one sentence, max 15 words. E.g.: "🍖 suggests meat but the image shows pasta."
  - Emoji matches or is neutral → ALWAYS null.
  - Atmosphere and location emojis (🌊 ☀️ 🌙 🌿 🌟 ✨ 🎵 🏡 🌅 🌃) represent mood and physical setting — never a visual requirement. Always null. Also when the text contains a matching location word — "by the river 🌊" → null.
  ⛔ NEVER write "The emoji matches perfectly" — only null.
humanSuggestions: [] unless the text names a specific food item that is not visible. NEVER generic photo coaching here.
recommendation = "retake" → no AI suggestions follow (empty in the subsequent step).
generalFeedback: Strengths only. NEVER name a problem here.
rewriteSuggestion: Concrete rewritten caption in the SAME LANGUAGE as the original text. null if actionNeeded = "none".
reshootGuidance: null unless actionNeeded = "choice".
actionNeeded: "none" if rating is excellent/good. "rewrite" if rating is fair. "choice" if rating is poor.
recommendationText: Must reference the most important specific finding by name — never a generic phrase. E.g.: "Remove the carafe and this shot is ready." Max 15 words.
⛔ NEVER: "A few adjustments will lift this image." — too generic and forbidden.

EXAMPLE A – clearly good image, text matches:
{ "contentMatch": { "rating": "excellent", "feedback": "The text and image match perfectly.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Warm side light highlights texture", "Clean composition"], "generalFeedback": "The dish dominates the frame with great texture and warm lighting.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "post-it", "recommendationText": "Post it! The food looks inviting." }

EXAMPLE B – steak, dim light, bokeh, wine glass:
{ "contentMatch": { "rating": "excellent", "feedback": "The image and text match.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Steak fat marbling is clear and appetising", "Bokeh background supports restaurant atmosphere"], "generalFeedback": "The steak is sharp and clearly visible with beautiful fat marbling.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "A credible restaurant shot ready to post." }

EXAMPLE C – usable image with one foreign object (water carafe):
{ "contentMatch": { "rating": "excellent", "feedback": "The text and image are in good alignment.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Plating is clear and appetising", "Light enhances dish colours naturally"], "generalFeedback": "The dish colours and plating are inviting.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "quick-fix", "recommendationText": "Remove the carafe and this shot is ready." }
↑ recommendation = "quick-fix" because the carafe is a removable candidate. The specific AI suggestion is returned separately.

EXAMPLE D – dish genuinely unidentifiable (technical flaw):
{ "contentMatch": { "rating": "good", "feedback": "The description matches what is being shown.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Table setting looks carefully done"], "generalFeedback": "The image shows care and intention — but the technical execution needs another attempt.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "retake", "recommendationText": "The dish is too unclear to post. Try natural side light." }

EXAMPLE E – good dessert, but text is about steak:
{ "contentMatch": { "rating": "poor", "feedback": "The text describes steak but the image shows dessert.", "rewriteSuggestion": "🍨 Our sorbet is the star of the season — fresh, vibrant and made with love.", "reshootGuidance": "Photograph a steak or meat dish with appropriate plating.", "actionNeeded": "choice" }, "whatWorks": ["The sorbet colour is vibrant and eye-catching", "Plating is clear and inviting"], "generalFeedback": "The dessert's vivid colours give the image strong visual impact.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "An inviting image — just update the text." }

EXAMPLE F – good dish, caption with wrong emoji:
{ "contentMatch": { "rating": "fair", "feedback": "The 🍖 emoji suggests meat but the image shows pasta.", "rewriteSuggestion": "🍝 Our homemade pasta — a classic that always hits the spot.", "reshootGuidance": null, "actionNeeded": "rewrite" }, "whatWorks": ["Dish colours are clear and appetising", "Plating communicates care"], "generalFeedback": "The pasta colours and plating are inviting.", "emojiMatch": "🍖 suggests meat but the image shows pasta.", "humanSuggestions": [], "recommendation": "post-it", "recommendationText": "Post it! Just fix the emoji in your text." }

EXAMPLE G – steak with sauce, text mentions creamy béarnaise but image shows dark red sauce:
{ "contentMatch": { "rating": "fair", "feedback": "The text mentions creamy béarnaise but the image shows a dark red sauce.", "rewriteSuggestion": "🥩 Our steak with a rich pepper sauce — juicy, bold and made with care.", "reshootGuidance": null, "actionNeeded": "rewrite" }, "whatWorks": ["Steak seared surface looks juicy", "Plating communicates quality"], "generalFeedback": "The steak is beautifully plated and looks juicy.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "good-enough", "recommendationText": "Update the sauce description and this shot is ready." }

EXAMPLE H — sorbet + red wine, headline "Treat yourself by the river", 🌊 in text, INDOOR setting, phone on table:
{ "contentMatch": { "rating": "excellent", "feedback": "The text is about sorbet dessert with red wine — the image shows exactly this.", "rewriteSuggestion": null, "reshootGuidance": null, "actionNeeded": "none" }, "whatWorks": ["Sorbet colour is vivid and eye-catching", "Warm dim lighting creates a welcoming atmosphere"], "generalFeedback": "The sorbet's vivid colours and warm evening atmosphere give the image strong visual impact.", "emojiMatch": null, "humanSuggestions": [], "recommendation": "quick-fix", "recommendationText": "Remove the phone and this shot is ready to post." }
↑ contentMatch = excellent (location and 🌊 ignored). recommendation = "quick-fix" (phone is a candidate). AI suggestion returned separately.

${systemCloser}`

  return { systemPrompt, userPrompt }
}

// ── TWO-CALL SPLIT: CALL 2 (AI Suggestion Prescription) ─────────────────────
// Receives Call 1's assessment as context. Focuses solely on what AI can
// physically fix in the photo. Returns { suggestions: [...] } only.

export interface Call2PromptParams extends PaidPromptParams {
  call1Assessment: {
    recommendation: string
    whatWorks: string[]
    generalFeedback: string
  }
}

export function buildCall2Prompt(
  language: string,
  { postText, businessType, mediaType, call1Assessment }: Call2PromptParams
): Promise<{ systemPrompt: string; userPrompt: string }> {
  return (async () => {
    const whatWorksText = call1Assessment.whatWorks.join(' • ')

    // Load language-specific system opener and closer
    const lang = language as Language
    const result = await loadLanguageConfig(lang, 'photo-analysis-call2-system')
    
    let systemOpener: string
    let systemCloser: string
    
    if (!result.success || !result.prompt) {
      console.warn(`Failed to load ${lang} photo-analysis-call2 system prompt, using inline version`)
      systemOpener = language === 'da'
        ? 'Du er en AI billedredigeringsassistent for lokale caféer og restauranter.\nDin opgave er at foreslå realistiske, automatiserede billedforbedringer der kan udføres af AI.'
        : 'You are an AI photo editing assistant for local cafés and restaurants.\nYour task is to suggest realistic, automated photo improvements that can be executed by AI.'
      systemCloser = ''
    } else {
      systemOpener = result.prompt.system
      systemCloser = result.prompt.closer
    }

    const systemPrompt = language === 'da'
      ? `${systemOpener}

En grundig vurdering af dette foto er allerede gennemført. Din eneste opgave er at identificere hvilke konkrete elementer AI-billedredigering sikkert og naturligt kan fjerne eller justere.

KONTEKST FRA VURDERING:
— Vurdering: ${call1Assessment.recommendation}
— Hvad fungerer: ${whatWorksText}
— Fotografisk styrke: ${call1Assessment.generalFeedback}

════ OPGAVE: FIND AI-FORBEDRINGSMULIGHEDER ════

TRIN 1 — SCENEOVERBLIK:
Heltemotivet er identificeret i konteksten ovenfor. Scan hele billedet for ikke-heltemotivet-elementer:
genstande på bordet, pletter på servering, baggrundselementer, farveproblemer.
Pletter, smuds og mærker på serveringsfade SKAL listes som selvstændige punkter — de slås IKKE sammen med et redskab eller anden genstand i samme zone.

TRIN 2 — KVALIFIKATIONSTEST (køres på hvert ikke-helte-element):
For hvert element: ville en seer bemærke det FØR eller SAMTIDIG med heltemotivet, OG reducerer det appetitten, oplevelsen eller første-indtrykket? Ja på begge → kandidat. Nej på én → scene-kontekst, ignorer.

Serveringsredskaber der hører direkte til retten (dessertske med dessertskål, steakkniv ved siden af bøffen, pastafork ved pasta) er altid scene-kontekst — aldrig kandidater, uanset placering eller synlighed.
Vinglas, borddækning, dæmpet lys og bokeh vil næsten altid fejle anden del af testen — de forstærker oplevelsen.

TILLADTE AI-ACTIONS (kun hvad AI kan udføre sikkert og naturligt):
remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

fix_exposure KAN KUN: korrigere global over- eller undereksponering.
fix_exposure KAN IKKE: fjerne lyskilder, ændre retningen på lys, fjerne skarpe pletter fra vinduer eller lamper.
Ét objekt per forslag. Aldrig to objekter i én title. Maks 6 forslag.

TITEL-REGEL: Titlen skal navngive det konkrete objekt eller farveattribut ved navn — aldrig kategorien.
Eksempel: "Fjern mobiltelefon" ikke "Fjern distraktion". "Varm røde toner op" ikke "Juster farver". "Plet på tallerkens venstre kant" ikke "Rens tallerken for pletter".

ACTION↔CATEGORY (ALDRIG kryds):
  remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
  adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

Ingen kandidater → returner { "suggestions": [] }

${systemCloser}`
    : `${systemOpener}

A thorough assessment of this photo has already been completed. Your only task is to identify which specific elements AI image editing can safely and naturally remove or adjust.

CONTEXT FROM ASSESSMENT:
— Recommendation: ${call1Assessment.recommendation}
— What works: ${whatWorksText}
— Photographic strengths: ${call1Assessment.generalFeedback}

════ TASK: FIND AI IMPROVEMENT OPPORTUNITIES ════

STEP 1 — SCENE INVENTORY:
The hero subject is identified in the context above. Scan the entire frame for non-hero elements:
objects on the table, marks on the serving, background elements, colour issues.
Marks, smudges, and stains on serving dishes MUST be listed as independent items — they are NEVER merged with a utensil or other object occupying the same zone.

STEP 2 — QUALIFICATION TEST (apply to each non-hero element):
For each element: would a viewer notice it BEFORE or AT THE SAME TIME as the hero subject, AND does it reduce appetite, the experience, or first impression? Yes to both → candidate. No to either → scene context, ignore.

Serving utensils that belong directly to the dish (dessert spoon with a dessert bowl, steak knife next to a steak, pasta fork with pasta) are always scene context — never candidates, regardless of placement or visibility.
Wine glasses, table setting, dim lighting, and bokeh will almost always fail the second part of the test — they reinforce the experience.

ALLOWED AI ACTIONS (only what AI can safely and naturally perform):
remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

fix_exposure CAN ONLY: correct global over- or underexposure.
fix_exposure CANNOT: remove light sources, change lighting direction, eliminate reflections from windows or lamps.
One object per suggestion. Never two objects in one title. Max 6 suggestions.

TITLE RULE: The title must name the specific object or colour attribute — never the category.
Example: "Remove phone" not "Remove distraction". "Warm red tones" not "Adjust colours". "Smudge on left plate edge" not "Clean plate".

ACTION↔CATEGORY (NEVER cross):
  remove_object / reduce_clutter / reduce_smudge → category: "cleaning"
  adjust_temperature_warm / adjust_temperature_cool / fix_exposure → category: "color"

No candidates → return { "suggestions": [] }

${systemCloser}`

    const userPrompt = language === 'da'
    ? `Identificer AI-forbedringsmuligheder på dette café-${mediaType === 'video' ? 'video' : 'billede'}.

${postText ? `Teksten siger: "${postText}"` : ''}
${businessType ? `Virksomhedstype: ${businessType}` : ''}

Returner KUN valid JSON uden markdown eller ekstra tekst:
{ "suggestions": [] }

Eller med forslag:
{ "suggestions": [{ "id": "unik_id", "category": "cleaning|color", "title": "Maks 6 ord", "reason": "Maks 12 ord", "location": "Præcis rumlig beskrivelse med proportionsreferencer, f.eks. 'øverste venstre hjørne ca. 20% af billedet', 'nederste højre hjørne' eller relativt til motivet: 'direkte til venstre for retten'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }] }`
    : `Identify AI improvement opportunities in this café ${mediaType === 'video' ? 'video' : 'image'}.

${postText ? `The text says: "${postText}"` : ''}
${businessType ? `Business type: ${businessType}` : ''}

Return ONLY valid JSON without markdown or extra text:
{ "suggestions": [] }

Or with suggestions:
{ "suggestions": [{ "id": "unique_id", "category": "cleaning|color", "title": "Max 6 words", "reason": "Max 12 words", "location": "Precise spatial description with proportional framing, e.g. 'upper-left quarter of the frame', 'bottom-right corner approx. 15% of image', or relative to hero subject: 'directly left of the dish'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }] }`

    return { systemPrompt, userPrompt }
  })()
}

// ── SIMPLE PROMPT V1 (backup) ────────────────────────────────────────────────
// Previous version of buildSimplePrompt — kept for reference/rollback.
// To reactivate: rename this to buildSimplePrompt and rename the above to buildSimplePromptV2.

export function buildSimplePromptV1(
  language: string,
  { postText, businessType, imageWidth, imageHeight }: PaidPromptParams = {}
): { systemPrompt: string; userPrompt: string } {

  // ── SYSTEM PROMPT ──────────────────────────────────────────────────────────
  const systemPrompt = language === 'da'
    ? `Du vurderer et foto til sociale medier for en lokal virksomhed i food & beverage branchen (café, restaurant, bar, kaffebar, vinbar, takeaway eller bageri).

Svar kort, konkret og handlingsorienteret. Undgå teknisk fotosprog.

Fokus er at hjælpe en travl ejer med at forstå:
• om fotoet er godt nok til opslag
• hvad der konkret kan forbedres
• om fotoet skaber lyst til at besøge stedet eller købe produktet

VURDER FOTOET UD FRA:

1. Stop-effekt
   Fanger billedet opmærksomheden hurtigt i feed?

2. Appetit og stemning
   Ser mad, kaffe eller drikke indbydende og fristende ud?
   Skaber fotoet hygge, stemning eller oplevelse?

3. Klarhed i motiv
   Er det tydeligt hvad man skal kigge på?
   Er der for mange forstyrrende elementer?

4. Lys og farver
   Er billedet lyst og naturligt?
   Ser farver appetitlige og realistiske ud?

5. Komposition og beskæring
   Er motivet tæt nok på?
   Er baggrunden rolig eller forstyrrende?
   Ville en beskæring gøre fotoet bedre?

6. Autenticitet
   Ser fotoet ægte og lokalt ud — ikke som et stockfoto?
   Kan gæster genkende oplevelsen i virkeligheden?

7. Liv og menneskelig følelse
   Er der hænder, mennesker, bevægelse, damp eller detaljer der skaber liv?

8. Mobilvisning og SoMe-egnethed
   Er motivet tydeligt i mobilvisning?
   Fungerer fotoet i kvadrat eller vertikal visning?

VIGTIGT:
• Prioritér autenticitet over perfektion
• Små forbedringer er bedre end avancerede fototips
• Hvis fotoet er dårligt, anbefal roligt at tage et nyt
• Hold tonen venlig, tryg og hjælpsom

MAPPING TIL JSON-OUTPUT:
- recommendation: "post-it" = klar til opslag, "good-enough" = godt men kan forbedres (én ting), "quick-fix" = tydelig forbedring som er let at udføre, "retake" = tag et nyt foto
- whatWorks: 2 korte konkrete punkter om hvad der virker i DETTE foto (maks 12 ord hver)
- generalFeedback: 2-3 sætninger, konkret opsummering af billedets styrker og eventuel svaghed
- recommendationText: én kort sætning der passer til recommendation-niveauet
- suggestions: op til 3 konkrete forbedringer — brug disse actions: remove_object (fjern fremmed genstand), reduce_clutter (fjern forstyrrende baggrund), reduce_smudge (fjern plet/tilsmudsning), adjust_temperature_warm, adjust_temperature_cool, fix_exposure
- Godt billede uden problemer: suggestions: []`
    : `You are evaluating a photo for social media for a local food & beverage business (café, restaurant, bar, coffee bar, wine bar, takeaway or bakery).

Respond concisely, concretely and action-oriented. Avoid technical photography jargon.

Focus on helping a busy owner understand:
• whether the photo is good enough to post
• what can concretely be improved
• whether the photo creates a desire to visit or buy

EVALUATE THE PHOTO BASED ON:

1. Stop power
   Does the image grab attention quickly in a feed?

2. Appetite and atmosphere
   Does the food, coffee or drink look inviting and tempting?
   Does the photo create cosiness, atmosphere or experience?

3. Subject clarity
   Is it immediately clear what to look at?
   Are there too many distracting elements?

4. Light and colours
   Is the image bright and natural?
   Do colours look appetising and realistic?

5. Composition and cropping
   Is the subject close enough?
   Is the background calm or distracting?
   Would a crop improve the photo?

6. Authenticity
   Does the photo look genuine and local — not like a stock photo?
   Can guests recognise the experience in real life?

7. Life and human feeling
   Are there hands, people, movement, steam or details that create life?

8. Mobile view and social media suitability
   Is the subject clear on mobile?
   Does the photo work in square or vertical format?

IMPORTANT:
• Prioritise authenticity over perfection
• Small improvements are better than advanced photography tips
• If the photo is poor, calmly recommend taking a new one
• Keep the tone friendly, reassuring and helpful

MAPPING TO JSON OUTPUT:
- recommendation: "post-it" = ready to post, "good-enough" = good but one thing would help, "quick-fix" = clear improvement that is easy to make, "retake" = take a new photo
- whatWorks: 2 short concrete points about what works in THIS photo (max 12 words each)
- generalFeedback: 2-3 sentences, concrete summary of the image's strengths and any weakness
- recommendationText: one short sentence matching the recommendation level
- suggestions: up to 3 concrete improvements — use these actions: remove_object (remove foreign object), reduce_clutter (remove distracting background), reduce_smudge (remove stain/smudge), adjust_temperature_warm, adjust_temperature_cool, fix_exposure
- Good photo with no issues: suggestions: []`

  // ── USER PROMPT ────────────────────────────────────────────────────────────
  const userPrompt = language === 'da'
    ? `Analyser dette foto til sociale medier.

${postText ? `Teksten siger: "${postText}"` : 'Ingen tekst inkluderet.'}
${businessType ? `Virksomhedstype: ${businessType}` : ''}

Returner KUN valid JSON uden markdown:
{
  "contentMatch": { "rating": "excellent|good|fair|poor", "feedback": "1-2 sætninger i én ubrudt linje." },
  "emojiMatch": null,
  "whatWorks": ["Specifikt punkt maks 12 ord", "Endnu et punkt maks 12 ord"],
  "generalFeedback": "2-3 sætninger i én ubrudt linje.",
  "suggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Kort sætning maks 15 ord"
}
SUGGESTION FORMAT: { "id": "unik_id", "category": "cleaning|color", "title": "Maks 6 ord", "reason": "Maks 12 ord", "location": "Præcis rumlig beskrivelse med proportionsreferencer, f.eks. 'øverste venstre hjørne ca. 20% af billedet' eller relativt til motivet: 'direkte til venstre for retten'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }
Maks 3 forslag. Godt billede = suggestions: [].`
    : `Analyse this photo for social media.

${postText ? `The text says: "${postText}"` : 'No text included.'}
${businessType ? `Business type: ${businessType}` : ''}

Return ONLY valid JSON without markdown:
{
  "contentMatch": { "rating": "excellent|good|fair|poor", "feedback": "1-2 sentences in one unbroken line." },
  "emojiMatch": null,
  "whatWorks": ["Specific point max 12 words", "Another point max 12 words"],
  "generalFeedback": "2-3 sentences in one unbroken line.",
  "suggestions": [],
  "recommendation": "post-it|good-enough|quick-fix|retake",
  "recommendationText": "Short sentence max 15 words"
}
SUGGESTION FORMAT: { "id": "unique_id", "category": "cleaning|color", "title": "Max 6 words", "reason": "Max 12 words", "location": "Precise spatial description with proportional framing, e.g. 'upper-left quarter of the frame', 'bottom-right corner approx. 15% of image', or relative to hero subject: 'directly left of the dish'", "action": "remove_object|reduce_clutter|reduce_smudge|adjust_temperature_warm|adjust_temperature_cool|fix_exposure" }
Max 3 suggestions. Good photo = suggestions: [].`

  return { systemPrompt, userPrompt }
}
