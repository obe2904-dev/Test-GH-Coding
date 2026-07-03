/**
 * Stage B0 — Business Model Classification Prompts
 * 
 * Fast pre-classification that runs before Prompt A to determine the structural
 * shape of the business. Uses minimal signals (establishment type, service programs,
 * location area type) to classify into one of four business models.
 * 
 * Output is passed to segmentAudience() so Stage B5 can skip TRIN 1, reducing
 * the prompt size by ~30%.
 */

export interface ClassifyBusinessPromptParams {
  establishmentType: string
  dayArcProgrammes: string[]
  areaType: string
  touristFactor: string
}

/**
 * Builds the system prompt for Stage B0 business classification.
 * @returns System prompt instructing the AI to output only valid JSON
 */
export function buildClassifyBusinessSystemPrompt(): string {
  return `You are a business model classifier for F&B businesses. Output ONLY valid JSON.`
}

/**
 * Builds the user prompt for Stage B0 business classification.
 * @param params Classification input parameters extracted from dataSources
 * @returns Complete user prompt with business model taxonomy and data
 */
export function buildClassifyBusinessUserPrompt(params: ClassifyBusinessPromptParams): string {
  const {
    establishmentType,
    dayArcProgrammes,
    areaType,
    touristFactor
  } = params

  return `Classify this F&B business into one of these models:
• offer_led — visit driven by WHAT they sell (coffee shop, bakery)
• occasion_led — visit driven by WHEN (breakfast, lunch, dinner programs drive traffic)
• destination_led — visit driven by WHERE (waterfront, rooftop, seasonal location)
• audience_led — visit driven by WHO comes (sports bar, student hangout)

DATA:
Establishment type: ${establishmentType}
Service programs: ${dayArcProgrammes.join(', ') || 'unknown'}
Area type: ${areaType}
Tourist factor: ${touristFactor}

Output JSON:
{
  "business_model_type": "offer_led | occasion_led | destination_led | audience_led",
  "primary_copy_hook": "product | location | programme | identity",
  "audience_breadth": "narrow | mixed | broad",
  "classification_rationale": "<one sentence why>"
}`
}
