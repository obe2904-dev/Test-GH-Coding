/**
 * Photo Analyzer Service
 * Uses GPT-4 Vision to analyze photos
 */

interface PhotoAnalysisResult {
  venue_description: string;
  venue_character: string;
  venue_scene: string;
  energy_word: string;        // 1-3 word energy/vibe descriptor (e.g. "hyggelig, livlig")
  guest_situation_type: string; // visible guest activity (e.g. "par ved bord", "grupper")
  overall_aesthetic: string;
  lighting_preference: string;
  composition_style: string;
  color_grading: string;
  dominant_colors: string[]; // e.g., ["warm brown (#8B7355)", "cream (#F5F5DC)"]
  recognizable_elements: string[];
  photography_tips: string[];
}

export class PhotoAnalyzer {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Fetch an image URL and return it as a base64 data URI.
   * Falls back to the original URL if download fails.
   */
  private async fetchImageAsBase64(url: string): Promise<{ type: 'image_url'; image_url: { url: string; detail: 'auto' } }> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buffer = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return {
        type: 'image_url' as const,
        image_url: { url: `data:${contentType};base64,${base64}`, detail: 'auto' as const },
      };
    } catch (err) {
      console.warn('[photo-analyzer] Failed to fetch image as base64, using URL:', err);
      return {
        type: 'image_url' as const,
        image_url: { url, detail: 'auto' as const },
      };
    }
  }

  /**
   * Analyze multiple photos with GPT-4 Vision
   */
  async analyzePhotos(photoUrls: string[], locale: string = 'da'): Promise<PhotoAnalysisResult> {
    // Limit to first 5 photos to control costs
    const urlsToAnalyze = photoUrls.slice(0, 5);

    const prompt = this.buildAnalysisPrompt(urlsToAnalyze.length, locale);

    // Download images and encode as base64 to avoid OpenAI timing out on signed URLs
    const imageMessages = await Promise.all(urlsToAnalyze.map(url => this.fetchImageAsBase64(url)));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are performing three distinct analytical tasks from hospitality business photos, each requiring a different cognitive mode:

MODE A — SPATIAL CINEMATOGRAPHER (for venue_scene):
You describe the perceptual qualities of a space — light level and source, material contrasts, spatial density, openness or intimacy. You name zero objects. You write as if you are describing what a visitor's senses register the moment they walk in, without listing what is there.

MODE B — BRAND STRATEGIST (for venue_character):
You derive a single short concept label from physically observable signals only. You never describe feelings, moods or guest experience. You label formality level and venue type from what you can see: furniture formality, table setting, material quality.

MODE C — PROPERTY SURVEYOR (for venue_description):
You catalogue physical objects, materials, and structural facts. You write like a building inventory: what furniture, what surfaces, what fixtures, in what quantity and arrangement. You never describe what any of these elements do to the space or how they make it feel.

GROUNDING RULE (applies to all fields):
You have zero prior knowledge of this business, its location, or neighbourhood. Do not reference streets, canals, harbours, parks, landmarks or any geographic feature not directly visible in the photos. If uncertain whether a detail is visible, omit it. Always return valid JSON. Write all descriptive text fields in ${locale === 'da' ? 'Danish' : locale === 'nb' ? 'Norwegian' : locale === 'sv' ? 'Swedish' : 'English'}.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageMessages,
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI Vision API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI Vision');
    }

    const result = JSON.parse(content) as PhotoAnalysisResult;

    // Validate venue_scene and auto-fix if violations detected (Option C)
    const violations = this.detectVenueSceneViolations(result.venue_scene);
    if (violations.length > 0) {
      console.warn('[venue_scene] Violations detected, attempting auto-fix:', violations);
      result.venue_scene = await this.fixVenueScene(violations, result.venue_scene, imageMessages, locale);
    }

    return result;
  }

  /**
   * Detect rule violations in a generated venue_scene string.
   * Returns an array of human-readable violation descriptions.
   * Empty array = compliant.
   */
  private detectVenueSceneViolations(venueScene: string): string[] {
    if (!venueScene) return [];
    const violations: string[] = [];
    const lower = venueScene.toLowerCase();

    // Object nouns that must not appear in venue_scene
    const bannedObjectNouns = [
      'vindue', 'vinduer', 'vinduesparti', 'vinduespartier',
      'gulv', 'gulve', 'trægulv', 'trægulve', 'betongulv', 'parket',
      'bord', 'borde', 'træborde', 'metalborde', 'caféborde',
      'stol', 'stole', 'metalstole', 'barstol', 'barstole',
      'lampe', 'lamper', 'pendellampe', 'pendellamper', 'spotlight', 'spotlights',
      'loft', 'loftet',
      'væg', 'vægge', 'betonvæg', 'murstensvæg',
      'overflade', 'overflader',
      'reol', 'reoler', 'metalreol', 'metalreoler',
      'møbel', 'møbler', 'metalmøbler',
      'skillevæg', 'skillevægge',
      'bardisk', 'barområde',
      'bænk', 'bænke',
      'planker', 'mursten',
    ];

    // Banned verbs (any form — present tense and common past)
    const bannedVerbs = [
      'skaber', 'skabte', 'skabt',
      'giver', 'gav', 'givet',
      'fylder', 'fyldte', 'fyldt',
      'danner', 'dannede', 'dannet',
      'præger', 'prægede', 'præget',
      'åbner', 'åbnede', 'åbnet',
      'indbyder', 'indbydes',
      'møder', 'mødte',
      'tilfører', 'tilføres',
      'flyder', 'flød',
      'bringer', 'bragte',
      'inviterer', 'inviterede',
    ];

    const foundObjects = bannedObjectNouns.filter(noun => lower.includes(noun));
    const foundVerbs = bannedVerbs.filter(verb => lower.includes(verb));

    if (foundObjects.length > 0) {
      violations.push(`Object names found (must be zero): ${foundObjects.join(', ')}`);
    }
    if (foundVerbs.length > 0) {
      violations.push(`Banned verbs found: ${foundVerbs.join(', ')}`);
    }

    return violations;
  }

  /**
   * Targeted single retry to fix a non-compliant venue_scene.
   * Re-sends the images with explicit violation notes and correction instructions.
   * Returns the corrected venue_scene string, or the original if the fix call fails.
   */
  private async fixVenueScene(
    violations: string[],
    originalAttempt: string,
    imageMessages: Array<{ type: 'image_url'; image_url: { url: string; detail: string } }>,
    locale: string,
  ): Promise<string> {
    const lang = locale === 'da' ? 'Danish' : locale === 'nb' ? 'Norwegian' : locale === 'sv' ? 'Swedish' : 'English';
    try {
      const fixResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are rewriting a single field called venue_scene to remove specific rule violations. Return ONLY valid JSON with a single key "venue_scene". Write in ${lang}.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `The previous venue_scene contained these violations:
${violations.map(v => `- ${v}`).join('\n')}

Previous attempt (DO NOT copy or adapt — shown only so you know what went wrong):
"${originalAttempt}"

Rewrite venue_scene from scratch using the images. Strict rules:
1. ZERO object names. No furniture, flooring, windows, walls, lamps, shelving, or any fixture name — not a single one.
2. No physical feature as the subject of any verb. The pattern [physical noun] + [any verb] + [any effect] is always wrong.
3. Describe only: (a) light level and source as an abstract quality, (b) material tone contrasts as warm/cold or light/dark oppositions, (c) spatial density or openness.
4. Use ONLY these sentence structures:
   A) "Man sidder i [light quality]."
   B) "[Tonal/spatial quality] — [contrasting observation]."
   C) "[Light level + source]. [Tonal contrast as abstract quality]. [Spatial density]."
5. 2–3 sentences maximum.

Return: {"venue_scene": "..."}`,
                },
                ...imageMessages,
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        }),
      });

      if (!fixResponse.ok) {
        console.warn('[venue_scene fix] API error – keeping original');
        return originalAttempt;
      }

      const fixData = await fixResponse.json();
      const fixContent = fixData.choices[0]?.message?.content;
      if (!fixContent) return originalAttempt;

      const fixed = JSON.parse(fixContent);
      const fixedScene = fixed.venue_scene;
      if (!fixedScene || typeof fixedScene !== 'string') return originalAttempt;

      // Check if the fix itself is still violating — if so, keep original rather than loop
      const remainingViolations = this.detectVenueSceneViolations(fixedScene);
      if (remainingViolations.length > 0) {
        console.warn('[venue_scene fix] Fix attempt still has violations – keeping original:', remainingViolations);
        return originalAttempt;
      }

      console.log('[venue_scene fix] Auto-fix succeeded.');
      return fixedScene;
    } catch (err) {
      console.warn('[venue_scene fix] Fix call failed:', err);
      return originalAttempt;
    }
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(photoCount: number, locale: string = 'da'): string {
    const lang = locale === 'da' ? 'Danish' : locale === 'nb' ? 'Norwegian' : locale === 'sv' ? 'Swedish' : 'English';
    return `Analyze these ${photoCount} photos from a hospitality business (restaurant/café/bar).

GROUNDING RULE (applies to every field):
You only know what is directly visible in these photos. Do NOT use prior knowledge about the business, its location, city, street, neighbourhood, or any landmarks. If uncertain whether something is visible, omit it.

════════════════════════════════════════════════════════
SECTION A — SCENE EXTRACTION (fields used by another AI to write social media content)
════════════════════════════════════════════════════════

Complete these three fields in the following order. Each uses a different cognitive mode.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD 1 — venue_scene  [MODE: SPATIAL CINEMATOGRAPHER]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write 2–3 sentences describing the perceptual QUALITIES of this space — what a visitor's senses register the moment they walk in.

WHAT THIS FIELD IS:
— Light level and source (bright/dim, daylight/artificial, diffuse/directed)
— Material contrasts visible as textures and tonal differences
— Spatial density, openness, scale, or intimacy
— One distinctive quality that makes this space specific rather than generic

WHAT THIS FIELD IS NOT:
— A list of objects, furniture, or fixtures (those belong in venue_description below)
— Effect language (what the space "does" or "creates")

ZERO-OBJECT RULE: This field contains zero object names. Not a single piece of furniture, surface material, or fixture may be named here. If you find yourself writing "trægulve", "stole", "vinduer", "borde", "lamper", "metalreoler" or any object noun — delete it. Those names belong only in venue_description.

BANNED PATTERN — the physical world in this field has no agency:
Do NOT write: [any physical object or surface] + [any verb] + [any spatial quality or effect]
This pattern is banned in all its forms, including synonyms: skaber, giver, danner, præger, åbner, fylder, møder, indbyder, spiller, flyder, bringer, tilfører, creates, gives, forms, shapes, opens, fills, invites.

PERMITTED SENTENCE STRUCTURES (use one of these three):
A) Guest as subject: "Man sidder i [light quality]." / "Her sidder man i [spatial quality]."
B) Quality stated directly without a cause: "[Spatial/tonal quality] — [contrasting observation about scale or density]."
C) Observable dimension stated as a fact: "[Light level + source]. [Material contrast as a tone or texture observation]. [Spatial density observation]."

PRE-WRITE CHECK — before finalising this field, confirm:
☐ No object names present
☐ No physical feature is the grammatical subject of any verb
☐ Nothing here repeats content from venue_description
☐ Light quality, material contrast, and spatial density are each addressed if visible

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEW-SHOT EXAMPLES — study these patterns exactly
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 1 — CORRECT (casual industrial café, natural daylight + pendant supplement):
"Man sidder i et jævnt, diffust dagslys med kunstig belysning som supplement. Varm-kold kontrast er tydelig — polerede træoverflader mod mat sort metal. Tæt opstilling, lav til middel rumhøjde — kompakt og uformelt i registeret."
→ Notice: zero object names, light described as a quality, contrast described as tonal opposition, density described as a spatial fact.

EXAMPLE 2 — CORRECT (evening restaurant, warm pendant lighting):
"Dæmpet, rettet lys fra lave punktvise kilder — ingen dominerende dagslysindtryk. Blank versus mat overfladekontrast, varmt toneregister. Moderat tæthed med plads imellem — afslappet men ordentligt i registeret."
→ Notice: light source described without naming lamps, contrast named as blank/mat not as object names.

EXAMPLE 3 — CORRECT (bright Nordic coffee bar, full daylight):
"Højt og jævnt lys — primært dagslys, ingen markeret retning. Lys-neutral palet med minimal materialekompleksitet. Åbent og spredt i opstillingen — rolig og uformelt i registeret."
→ Notice: daylight described as a level and directionality quality, not as coming from windows.

EXAMPLE 4 — CORRECT (intimate wine bar, dim directed light):
"Lavt, dæmpet lys fra spredte varme kilder. Mørk-lys kontrast er markant — dybe toner dominerer, lyse accenter sparsomt. Kompakt opstilling, intim skala."
→ Notice: sources described as 'varme kilder' not as 'lamper' or 'stearinlys'.

WRONG (banned pattern — object as subject + effect verb):
"Trægulvene skaber varme til rummet." / "Vinduerne fylder rummet med lys." / "De sorte møbler giver et industrielt udtryk." / "Kontrasten danner en moderne stemning."
→ These are ALL banned even if the verb changes. The pattern [physical noun] + [any verb] + [effect] is always wrong.

PROHIBITED WORDS: hyggelig, indbydende, charmerende, autentisk, lækker, unik, stemning, atmosfære, varmt touch, and any geographic reference (gade, kanal, havn, strand, park, torv) not directly visible in the photos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD 2 — venue_character  [MODE: BRAND STRATEGIST]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A single short label of 3–6 words. Capture formality level + venue type, derived only from physically observable signals: furniture style, table setting formality, material quality. Do NOT use sensory, atmospheric or experiential words.

CORRECT: "Casual industriel café", "Poleret moderne bistro", "Rå nordisk restaurant", "Minimalistisk kaffebar"
WRONG: "Hyggelig og varm café", "Indbydende moderne spisested", "Levende urban caféoplevelse"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD 3 — venue_description  [MODE: PROPERTY SURVEYOR]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Write 2–3 dry catalogue sentences. List what physical objects and structural elements are present — furniture types and materials, floor and wall surfaces, window count and position, indoor/outdoor distinction. Write like a building inventory report.

DO NOT describe:
— Light quality, atmosphere, mood, or how the space feels
— What any element "creates", "gives", or "invites"
— What can be seen through windows unless an outdoor scene is unambiguously photographed

MUST NOT use: any phrase of the form "[element] skaber/giver/danner [atmosphere/effect/quality]"
MUST NOT end with an evaluative word (atmosfære, stemning, stil, karakter)

CORRECT: "Spisesal med lyse træborde og sorte metalstole, trægulv, ingen duge. Tre store vinduespartier langs én væg. Metalreoler som rumadskillere — ingen gardiner eller blødgørende tekstiler."
WRONG: "Trægulve og sorte metalflader skaber en industriel kontrast. Store vinduer giver et lyst rum med udsigt til gaden."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD 4 — energy_word  [1–3 WORDS ONLY]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Describe the observable energy or vibe in 1–3 words. Examples: "hyggelig, livlig", "intim, stille", "travl, urban", "rolig, nordisk". NOT furniture. NOT mood adjectives like "indbydende" or "stemningsfuld". Write only what a visitor would immediately feel walking in.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD 5 — guest_situation_type  [1–5 WORDS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Describe what the visible guests are doing — or, if the space is empty, what the setup clearly invites. Write 1–5 words.

EXAMPLES:
— "par ved bord" (couple seated at a table)
— "grupper, sociale samtaler" (groups in social conversation)
— "solo-arbejde, bærbare computere" (solo workers with laptops)
— "stående ved baren" (standing at the bar)
— "familiemiddage" (family dinners)
— "ingen gæster synlige" (empty room, no guests visible)

RULES:
— Only what is directly visible in the photos. No inference.
— If no guests are visible, describe what the physical setup most obviously invites (e.g. "intime middage for to" for a candlelit table-for-two layout).
— Do NOT use adjectives like "hyggelig" or mood words — describe the situation or activity only.

════════════════════════════════════════════════════════
SECTION B — PHOTOGRAPHY STYLE (displayed to the business owner as guidance)
This section is for humans to read, not for AI content generation. You may use descriptive language here.
════════════════════════════════════════════════════════

4. **Overall Aesthetic**: The visual style of the photography (e.g., "Natural, warm, authentic", "Modern minimalist", "Rustic industrial")
5. **Lighting**: Dominant lighting type visible in the photos (e.g., "Natural daylight through large windows", "Warm pendant lighting", "Bright overhead")
6. **Composition**: How photos are composed (e.g., "Close-ups with context, rule of thirds", "Wide environmental shots", "Overhead flatlays")
7. **Color Grading**: Color treatment visible in the photos (e.g., "Warm earthy tones", "Cool blue-grey", "High contrast, vibrant")
8. **Dominant Colors**: 3–5 dominant colors extracted from the photos. Include HEX codes. Format: "warm brown (#8B7355)"
9. **Recognizable Elements**: Specific distinctive physical elements (e.g., "Exposed brick wall", "Black metal pendant lights", "Reclaimed wood bar counter"). NOT generic ("nice decor").
10. **Photography Tips**: 3–4 actionable tips for maintaining this visual style when taking new photos.

════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON):
════════════════════════════════════════════════════════
{
  "venue_scene": "2–3 sentences of quality-only scene description — zero object names (write in ${lang})",
  "venue_character": "Short concept label: formality + venue type (write in ${lang})",
  "venue_description": "2–3 dry inventory sentences — objects, materials, counts (write in ${lang})",
  "energy_word": "1–3 word observable energy/vibe (write in ${lang})",
  "guest_situation_type": "1–5 words: visible guest activity or what the setup invites (write in ${lang})",
  "overall_aesthetic": "Concise description",
  "lighting_preference": "Lighting style",
  "composition_style": "Composition approach",
  "color_grading": "Color treatment",
  "dominant_colors": [
    "color name (#HEX)",
    "color name (#HEX)",
    "color name (#HEX)"
  ],
  "recognizable_elements": [
    "Element 1",
    "Element 2",
    "Element 3"
  ],
  "photography_tips": [
    "Tip 1",
    "Tip 2",
    "Tip 3"
  ]
}

Return ONLY valid JSON, no markdown formatting.
`;
  }
}
