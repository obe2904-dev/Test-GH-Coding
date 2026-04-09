// ─── Prompt builders for edit-photo ─────────────────────────────────────────

export interface EditSuggestion {
  id: string
  category: 'cropping' | 'cleaning' | 'color'
  title: string
  reason: string
  location: string
  action: string
}

// ── Editing Instructions ──────────────────────────────────────────────────────

export function buildEditInstructions(suggestions: EditSuggestion[], language: string): string {
  const da = language === 'da'
  return suggestions.map(s => {
    switch (s.action) {
      // --- Cleaning: direct removal/reduction with precise location ---
      case 'remove_object':
        return da
          ? `- På dette præcise sted — ${s.location} — er der et fremmed element (${s.title}: ${s.reason}), der ikke hører hjemme i madpræsentationen. Fjern eller minimer KUN dette specifikke fremmede objekt. ⛔ ABSOLUT REGEL: FJERN ALDRIG tallerkener, skåle, glas, kopper, bestik, mad, sauce eller pynt — selv hvis de er tæt på eller rører målområdet. Hvis elementet ikke kan isoleres rent fra de omkringliggende præsentationselementer, anvend kun den mindste, mest subtile synlige reduktion. Fyld evt. frigjort område med den umiddelbart omkringliggende overfladestruktur (bord, dug, baggrund osv.). RØR IKKE noget andet i billedet.`
          : `- At this precise location — ${s.location} — there is a foreign element (${s.title}: ${s.reason}) that does not belong to the food presentation. Remove or minimise ONLY that specific foreign item. ⛔ ABSOLUTE GUARD: NEVER remove a plate, bowl, glass, cup, tableware, cutlery, food, sauce, or garnish — even if these are near or touching the target area. If the foreign element cannot be cleanly isolated from the surrounding presentation items, apply only the smallest, subtlest visible reduction. Fill any cleared spot with the immediately surrounding surface texture (table, tablecloth, background, etc.). Do NOT touch anything else in the image.`
      case 'reduce_clutter':
        return da
          ? `- FJERN disse forstyrrende baggrundselementer (${s.title}: ${s.reason}) i dette område: ${s.location}. Erstat med den naturlige baggrundstekstur. Bevar alle intentionelle forgrundsobjekter. RØR IKKE noget andet i billedet.`
          : `- REMOVE the distracting background elements (${s.title}: ${s.reason}) at this area: ${s.location}. Replace with the natural background texture. Preserve all intentional foreground objects. Do NOT touch anything else in the image.`
      case 'reduce_smudge':
        return da
          ? `- FJERN denne plet/mærke/tilsmudsning (${s.title}) fra dette sted: ${s.location}. Gendan den underliggende overfladestruktur, så den problemfrit matcher det rene omkringliggende område. RØR IKKE noget andet i billedet.`
          : `- REMOVE this stain/smudge/mark (${s.title}) from this location: ${s.location}. Restore the underlying surface texture so it matches the clean surrounding area seamlessly. Do NOT touch anything else in the image.`
      // --- Color: targeted global adjustments ---
      case 'adjust_temperature_warm':
        return da
          ? `- VARM farvetemperaturen i hele billedet med ca. 20–25%. Maden skal synligt se mere gylden og appetitlig ud. Ændringen skal være tydeligt mærkbar — en subtil forskydning er ikke nok.`
          : `- WARM the color temperature of the entire image by approximately 20–25%. The food must visibly look more golden and appetising. This change must be clearly perceptible — a subtle shift is not enough.`
      case 'adjust_temperature_cool':
        return da
          ? `- KØL farvetemperaturen i hele billedet med ca. 20–25%. Maden skal synligt se mere frisk og mindre gul/orange ud. Ændringen skal være tydeligt mærkbar — en subtil forskydning er ikke nok.`
          : `- COOL the color temperature of the entire image by approximately 20–25%. The food must visibly look fresher and less yellow/orange. This change must be clearly perceptible — a subtle shift is not enough.`
      case 'fix_exposure':
        return da
          ? `- KORRIGER EKSPONERING: lys op i undereksponerede skyggeområder og/eller reducer overeksponerede highlights med 10–15%, så maddetaljerne er tydeligt synlige. Ændr ikke scenekomposition.`
          : `- FIX EXPOSURE: brighten underexposed shadow areas and/or reduce blown highlights by 10–15% so the food details are clearly visible. Do not alter the scene composition.`
      default:
        return da
          ? `- UDFØR følgende redigering — ${s.title}: i dette område: ${s.location}. Årsag: ${s.reason}. Foretag kun denne målrettede ændring og lad alt andet fremstå visuelt uændret.`
          : `- APPLY the following edit — ${s.title}: at this location: ${s.location}. Reason: ${s.reason}. Make only this targeted change and leave everything else visually unchanged.`
    }
  }).join('\n')
}

// ── System + User Prompts ─────────────────────────────────────────────────────

export function buildEditPrompt(
  language: string,
  editingInstructions: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = language === 'da'
    ? `Du er en præcis billedredigeringsassistent. Din opgave er at udføre præcis de angivne ændringer og lade resten af billedet fremstå visuelt uændret.

REGLER PR. KATEGORI:

CLEANING / FJERNELSE:
- Fjern kun det mindst nødvendige område for at eliminere distraktionen
- Rekonstruér området udelukkende med den umiddelbart omkringliggende baggrundstekstur
- Bevar naturlige skygger og refleksioner
- Blend overgange blødt for at undgå synlige kanter
- Bevar teksturretning og variation (undgå glatte eller "perfekte" områder)
- ⛔ ABSOLUTT REGEL: Fjern ALDRIG tallerkener, skåle, glas, bestik, serveringsfade eller madkomponenter — disse er kernen i præsentationen og må ALDRIG fjernes, selv hvis de befinder sig i nærheden af målområdet
- Ændr aldrig mad, drikke, garnish-detaljer eller overfladen af nogen serveringskomponent
- Hvis fjernelse er risikabel, foretræk subtil blending frem for aggressiv rekonstruktion

CROP:
- Beskær kun for at forbedre fokus og komposition
- Skær aldrig gennem primære mad- eller drikkeelementer
- Bevar naturlig luft omkring motivet (undgå for tæt beskæring)
- Undgå at placere vigtige elementer ubehageligt tæt på billedets kanter
- Let off-center placering er tilladt hvis det forbedrer visuel balance
- Ændr ikke perspektiv eller rumlige relationer

COLOR:
- Justér global farve og eksponering i overensstemmelse med redigeringsinstruktionerne
- Bevar naturlig stemning og autenticitet

GENERELLE PRINCIPPER:
- Foretræk subtile og naturlige ændringer frem for aggressive
- Tilføj aldrig nye objekter, lys, effekter eller teksturer
- Alt uden for redigeringsområdet skal fremstå visuelt uændret`
    : `You are a precise photo retouching assistant. Your task is to apply exactly the specified changes and leave the rest of the image visually unchanged.

RULES PER CATEGORY:

CLEANING / REMOVAL:
- Remove only the minimum area necessary to eliminate the distraction
- Reconstruct the area exclusively with the immediately surrounding background texture
- Preserve natural shadows and reflections
- Blend transitions softly to avoid visible edges
- Preserve texture direction and variation (avoid smooth or "perfect" areas)
- ⛔ ABSOLUTE RULE: NEVER remove plates, bowls, glasses, cutlery, serving dishes, or food components — these are the core presentation elements and must NEVER be removed, even if they are near or adjacent to the target area
- Never alter food, drink, garnish details or the surface of any serving component
- If removal is risky, prefer subtle blending over aggressive reconstruction

CROP:
- Crop only to improve focus and composition
- Never cut through primary food or drink elements
- Preserve natural breathing room around the subject (avoid over-tight cropping)
- Avoid placing important elements uncomfortably close to the image edges
- Slight off-center placement is allowed if it improves visual balance
- Do not change perspective or spatial relationships

COLOR:
- Apply global colour and exposure adjustments as specified in the edit instructions
- Preserve natural atmosphere and authenticity

GENERAL PRINCIPLES:
- Prefer subtle and natural changes over aggressive ones
- Never add new objects, light sources, effects or textures
- Everything outside the edit area must appear visually unchanged`

  const userPrompt = language === 'da'
    ? `Anvend præcis følgende ændringer på dette billede:

${editingInstructions}

HUSK:
- Udfør kun de specificerede ændringer
- Bevar et naturligt og autentisk udtryk
- Hvis en ændring ikke kan udføres naturligt, lav en mere subtil version
- Returner det redigerede billede`
    : `Apply exactly the following changes to this image:

${editingInstructions}

REMEMBER:
- Perform only the specified changes
- Preserve a natural and authentic look
- If a change cannot be done naturally, apply a more subtle version
- Return the edited image`

  return { systemPrompt, userPrompt }
}
