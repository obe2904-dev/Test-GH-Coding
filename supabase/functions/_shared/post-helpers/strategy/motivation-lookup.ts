/**
 * Motivation Lookup Table
 *
 * Deterministic strategic implications for each visit motivation key that can appear
 * in LocationContext.matched_motivations. Replaces AI inference of what a motivation
 * means strategically — the AI receives pre-classified implications instead.
 */

export interface MotivationStrategicData {
  label_dk: string;      // Human-readable Danish label
  implication: string;   // Behavioral description: what this motivation means for guest decisions
  content_angle: string; // Concrete content direction to activate this motivation
  timing_note: string;   // Best timing for content targeting this motivation
  cta_bias: 'book' | 'visit' | 'share' | 'none';
}

export const MOTIVATION_MAP: Record<string, MotivationStrategicData> = {
  socialt_samvær: {
    label_dk: 'Socialt samvær',
    implication:
      'Gæsterne vælger stedet som social ramme — grupper, venner, kollegaer. Stemning, plads og mulighed for samtale er afgørende. Turen er et mål i sig selv.',
    content_angle:
      'Vis selskab, stemning og liv. Billeder med mennesker i grupper. Ordvalg: "Tag vennerne med", "I aften", "Perfekt til selskabet".',
    timing_note: 'Bedst torsdag–lørdag, eftermiddag og aften',
    cta_bias: 'visit',
  },
  frokostnødvendighed: {
    label_dk: 'Hverdagsfrokost',
    implication:
      'Gæsterne bruger stedet til en nødvendig og god hverdagspause. Nærhed, pris/værdi og lethed er afgørende. Beslutningen tages tæt på tidspunktet.',
    content_angle:
      'Vis frisk og tilgængeligt mad, fremhæv nærhed og pris. Ordvalg: "Dagens frokost", "Klar fra kl. 11", "Frisk og hurtigt".',
    timing_note: 'Bedst mandag–fredag kl. 10–12',
    cta_bias: 'visit',
  },
  destinationsbesøg: {
    label_dk: 'Destinationsbesøg',
    implication:
      'Gæsterne rejser aktivt til stedet — det er en del af en plan eller udflugt. Selve stedet er en attraction. Kvalitet og det unikke justificerer turen.',
    content_angle:
      'Fremhæv det der gør stedet til en destination — et særligt tilbud, en unik beliggenhed, en oplevelse man ikke finder andre steder. Ordvalg: "Kom forbi", "Oplev", "Værd at tage turen".',
    timing_note: 'Bedst weekend og helligdage — planlagte ture',
    cta_bias: 'visit',
  },
  familieudflugt: {
    label_dk: 'Familieudflugt',
    implication:
      'Familier med børn vælger stedet som del af en familiedag. Tryghed, plads, børnevenlig menu og orden er afgørende. Forældrene beslutter — børnene er dealbreaker.',
    content_angle:
      'Vis lys, plads og imødekommende atmosfære. Nævn børnemenu, plads til barnevogn eller aktivitetsmuligheder. Ordvalg: "Perfekt til familien", "Børn er velkomne", "God plads".',
    timing_note: 'Bedst lørdag og søndag, skolefridage og ferier',
    cta_bias: 'visit',
  },
  hygge_lokal: {
    label_dk: 'Lokal hygge',
    implication:
      'Stammegæster og lokale der søger en tryg, velkendt ramme. Genkendelse, det personlige touch og konsistens er vigtigst. De handler af vane og loyalitet.',
    content_angle:
      'Vis det kendte ansigt, de faste ritualer og stammegæsternes favoritter. Ordvalg: "Som altid", "Vi er her", "Din faste plads".',
    timing_note: 'Relevant alle dage — stærkest hverdagsmorgen og -middag',
    cta_bias: 'none',
  },
  turist_oplevelse: {
    label_dk: 'Turistoplevelse',
    implication:
      'Besøgende der søger autentisk lokal oplevelse. De er åbne for noget nyt men har brug for tydelige signaler om kvalitet og lokal karakter. Anbefaling og synlighed er afgørende.',
    content_angle:
      'Fremhæv det lokale, det autentiske, det de ikke finder hjemme. Vis stedets karakter og rødder. Ordvalg: "Originalt dansk", "Lokalt forankret", "Siden...".',
    timing_note: 'Stærkest i turistsæson (maj–september), fredag–søndag',
    cta_bias: 'visit',
  },
  arbejdsfrokost: {
    label_dk: 'Arbejdsfrokost',
    implication:
      'Kollegagrupper og erhvervsliv der holder frokostmøder eller velfortjente pauser. Professionel ro, god service og lidt mere end det sædvanlige er vigtigt. Reservation foretrækkes.',
    content_angle:
      'Vis professionel og rolig stemning. Fremhæv plads til grupper og hurtig service. Ordvalg: "Til erhvervsfrokosten", "Bordreservation", "Plads til jer alle".',
    timing_note: 'Bedst mandag–fredag kl. 11–14',
    cta_bias: 'book',
  },
  forkælelse: {
    label_dk: 'Forkælelse og belønning',
    implication:
      'Gæsterne bruger stedet til at forkæle sig selv eller andre — en særlig anledning eller bevidst valgt nydelse. Kvalitet og den sanselige oplevelse er i fokus.',
    content_angle:
      'Vis kvalitet, sanselig nydelse og den gode oplevelse. Ordvalg: "Undt dig selv", "Forkæl dem du holder af", "Det lille ekstra".',
    timing_note: 'Bedst fredag–søndag og særlige anledninger',
    cta_bias: 'visit',
  },
  discovery: {
    label_dk: 'Opdagelse og nysgerrighed',
    implication:
      'Åbne og nysgerrige gæster der ikke er bundet af vane — de er ude for at opdage noget nyt. Overraskelse og kurateret nyhed virker stærkt på denne gruppe.',
    content_angle:
      'Vis det overraskende, det nye på kortet, det lidt anderledes. Ordvalg: "Prøv noget nyt", "Har du set vores...", "Nyhed på kortet".',
    timing_note: 'Relevant hele ugen — særligt stærkt i lav-trafik perioder',
    cta_bias: 'share',
  },
};

/**
 * Build a prompt-ready block describing the strategic implication of each motivation.
 * Each matched motivation is expanded with its pre-computed data.
 * Used in Phase 0 and Phase 1 prompt builders.
 */
export function buildMotivationBlock(motivations: string[]): string {
  if (!motivations || motivations.length === 0) {
    return '(ingen besøgsmotiver registreret)';
  }
  return motivations
    .map(key => {
      const data = MOTIVATION_MAP[key];
      if (!data) return `- ${key}: (ingen strategisk data tilgængelig)`;
      return `- ${data.label_dk}
  Adfærd: ${data.implication}
  Content-vinkel: ${data.content_angle}
  Timing: ${data.timing_note}${data.cta_bias !== 'none' ? `\n  CTA-bias: ${data.cta_bias}` : ''}`;
    })
    .join('\n');
}
