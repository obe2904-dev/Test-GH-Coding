/**
 * PLATFORM & WEATHER HELPERS
 * Build prompt sections for platform labels, CTA guidance, media guidance,
 * and translate weather/economic patterns.
 */

import type { WeekContext, Platform } from '../types/strategy-types.ts';

// ============================================================
// PLATFORM HELPERS
// ============================================================

export function buildPlatformLabel(platforms: Platform[]): string {
  if (platforms.length === 2) {
    return `Aktive platforme: Facebook + Instagram (begge)
- Idéer skal fungere på begge platforme
- Hashtags og CTA tilpasses per platform i senere lag (Layer 1-9)
- I Layer 0: fokusér på idé og strategi, IKKE platform-specifikke detaljer`;
  }
  if (platforms.includes('instagram')) {
    return `Aktiv platform: Kun Instagram
- Prioritér visuelt stærkt indhold
- Reels-venlige idéer foretrækkes (photo_reel)
- CTA: "Link i bio" for booking/traffic (ingen klikbare links i posts)`;
  }
  return `Aktiv platform: Kun Facebook
- Tekst og storytelling kan være længere
- Links kan inkluderes direkte i posts
- CTA: Direkte booking-links og "Klik her" er muligt`;
}

export function buildCTAGuidance(platforms: Platform[]): string {
  if (platforms.length === 2) {
    return `
CTA-STRATEGI (begge platforme):
- "booking" intent: Bruges når målet er reservationer. Tilpasses i Layer 1-9 (FB: direkte link, IG: "link i bio")
- "engagement" intent: Stil spørgsmål, opfordr til kommentarer - fungerer ens på begge
- "awareness" intent: Visuelt stærkt, delbart indhold - fungerer ens på begge
- "event_promo" intent: Event-detaljer med opfordring til deltagelse
- "traffic" intent: Drive besøg til hjemmeside/menu. Tilpasses i Layer 1-9 (FB: direkte link, IG: "link i bio")`;
  }
  if (platforms.includes('instagram')) {
    return `
CTA-STRATEGI (Instagram):
- "booking" intent: Altid "Link i bio" eller story-sticker - aldrig direkte link i post
- "engagement" intent: Spørgsmål, polls i stories, "tag en ven"
- "awareness" intent: Visuelt stærkt, reel-venligt, delbart
- "event_promo" intent: Stories + feed post combo
- "traffic" intent: "Link i bio" - aldrig direkte link i post`;
  }
  return `
CTA-STRATEGI (Facebook):
- "booking" intent: Direkte booking-link i post, "Book nu" knap
- "engagement" intent: Spørgsmål, afstemninger, "del med en ven"
- "awareness" intent: Delbart indhold, lokal relevans
- "event_promo" intent: Facebook Events integration, "Interesseret?" CTA
- "traffic" intent: Direkte link til hjemmeside/menu i post`;
}

export function buildMediaGuidance(context: WeekContext): string {
  const hasIG = context.platforms.includes('instagram');

  return `Tilgængelige medie-typer:
- "photo": Enkelt billede (statisk post). Brugeren tager/uploader ét billede.
- "photo_reel": System-genereret Reel/video fra 1-4 fotos via FFmpeg. Brugeren tager bare fotos - systemet laver reel automatisk. INGEN ekstra indsats for brugeren.
- "carousel": Multi-billede swipe-post (2-6 billeder). God til menuer, events, før/efter.

${hasIG ? 'Instagram prioriterer Reels i algoritmen - foreslå 1-2 photo_reels per uge for bedre rækkevidde.' : 'Facebook prioriterer engagement - mix af photo og carousel fungerer bedst.'}

VIGTIGT: Brugeren er en travl restauratør. Forslagene skal være REALISTISKE at udføre.
- photo: Nemt (tag ét billede med telefon)
- photo_reel: Nemt (tag 1-4 fotos, systemet gør resten)  
- carousel: Kræver lidt mere (tag 2-6 fotos der hænger sammen)`;
}

export function buildMediaMixGuidance(targetPostCount: number): string {
  if (targetPostCount <= 3) {
    return '2 photo + 1 photo_reel (realistisk for 3 posts)';
  }
  if (targetPostCount <= 5) {
    return '3 photo + 1-2 photo_reel + 0-1 carousel (realistisk for 5 posts)';
  }
  return '3-4 photo + 2 photo_reel + 0-1 carousel (realistisk for 7 posts)';
}

// ============================================================
// WEATHER & ECONOMIC TRANSLATORS
// ============================================================

export function translateCondition(condition: string): string {
  const map: Record<string, string> = {
    clear: 'klart vejr',
    sunny: 'solskin',
    partly_cloudy: 'delvist skyet',
    cloudy: 'overskyet',
    rain: 'regn',
    snow: 'sne',
    sleet: 'slud',
    windy: 'blæsende',
    fog: 'tåge',
  };
  return map[condition.toLowerCase()] || condition;
}

export function translateEconomicPattern(pattern: string): string {
  const translations: Record<string, string> = {
    salary_week: 'Lønnings-uge',
    normal_spend: 'Normal forbrug',
    budget_conscious: 'Budget-bevidst',
    december_high: 'December højsæson',
    july_vacation: 'Juli ferie',
  };
  return translations[pattern] || pattern;
}

export function buildWeatherSummary(context: WeekContext): string {
  return context.weather.days.map((d) => {
    const reliability = d.reliability === 'specific'
      ? '(pålidelig)'
      : d.reliability === 'cautious'
        ? '(forsigtig vurdering)'
        : '(sæsonbaseret)';
    return `- ${d.date}: ${d.temp_min}-${d.temp_max}°C, ${translateCondition(d.condition)} ${reliability}`;
  }).join('\n');
}
