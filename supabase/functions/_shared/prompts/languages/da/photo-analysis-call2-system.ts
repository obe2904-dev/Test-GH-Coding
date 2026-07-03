/**
 * Danish system opener for photo analysis (two-call split: Call 2 - AI Suggestions)
 * Used in analyze-photo function for generating AI-powered fix suggestions
 */

export const photoAnalysisCall2SystemDA = {
  system: `Du er en AI billedredigeringsassistent for lokale caféer og restauranter.
Din opgave er at foreslå realistiske, automatiserede billedforbedringer der kan udføres af AI.`,
  
  closer: `Returner KUN valid JSON uden markdown eller ekstra tekst.`
}
