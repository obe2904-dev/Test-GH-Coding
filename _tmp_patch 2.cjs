const fs = require('fs');
const path = 'supabase/functions/generate-text-from-idea/prompt-builders.ts';
let content = fs.readFileSync(path, 'utf8');

const OLD = `  // sceneMoodOpeningHint — for behind_scenes/atmosphere/team_people: reinforce that
  // openings must come from a documented source, not abstract mood or training knowledge.
  // When an ANKER: line is present, venueAnchorProtagonistHint already covers this message
  // with more specificity — injecting both creates redundancy that inflates the middle.
  const sceneMoodOpeningHintMap: Record<string, string> = {`;

const NEW = `  // sceneMoodOpeningHint — for behind_scenes/atmosphere/team_people: reinforce that
  // openings must come from a documented source, not abstract mood or training knowledge.
  // When an ANKER: line is present, venueAnchorProtagonistHint already covers this message
  // with more specificity — injecting both creates redundancy that inflates the middle.
  // Source reference is now post-type-aware:
  //   atmosphere/team_people with venueScene → reference PRIMÆR FAKTAKILDE (scene-register)
  //   behind_scenes or fallback             → reference PRIMÆR FAKTAKILDE (inventory)
  const isAtmosphereTypeForHint = contentType === 'atmosphere' || contentType === 'team_people'
  const hasVenueSceneForHint    = Boolean((opts as any).venueScene) && isAtmosphereTypeForHint
  const primarySourceLabel = hasVenueSceneForHint
    ? '📸 PRIMÆR FAKTAKILDE (scene-register)'
    : '📸 PRIMÆR FAKTAKILDE'
  const noPhotoDataAtAll = !opts.venueIdentity && !(opts as any).venueScene
  const sceneMoodOpeningHintMap: Record<string, string> = {`;

if (!content.includes(OLD)) { console.error('NOT FOUND'); process.exit(1); }
content = content.replace(OLD, NEW);

// Also update the three template literal lines that reference '📸 PRIMÆR FAKTAKILDE' to use primarySourceLabel
// and update !opts.venueIdentity to noPhotoDataAtAll
const OLD2 = `    da: \`⚠️ ÅBNINGSREGEL FOR DETTE OPSLAG: Brandets skriveregler kræver konkrete åbninger. Din første sætning SKAL være forankret i ét element du kan pege på i \${hasVenueAnchor ? 'ANKER-linjen i INDHOLD (det bekræftede faktum)' : '📸 PRIMÆR FAKTAKILDE'}, INDHOLD eller BRANDSTEMME-blokken. Abstrakt stemning ("varmen spreder sig", "stilheden falder ind", "aftenen folder sig ud") er ikke en kilde — det er en generisk hallucination.\${hasVenueAnchor ? ' ANKER-linjen er din primære faktakilde — brug den.' : !opts.venueIdentity ? ' Ingen fotobeskrivelse er tilgængelig — brug konceptankre og stedsidentitet fra BRANDSTEMME-blokken som dit konkrete fundament.' : ''}
\`,
    sv: \`⚠️ ÖPPNINGSREGEL FÖR DETTA INLÄGG: Varumärkets skrivinstruktioner kræver konkrete åbninger. Din första mening MÅSTE vara förankrad i ett element du kan peka på i \${hasVenueAnchor ? 'ANKAR-raden i INNEHÅLL (det bekräftade faktumet)' : '📸 PRIMÄR FAKTAKÄLLA'}, INNEHÅLL eller VARUMÄRKESRÖST-blocket. Abstrakt stämning ("värmen sprider sig", "tystnaden infinner sig") är inte en källa — det är en generisk hallucination.\${hasVenueAnchor ? ' ANKAR-raden är din primära faktakälla — använd den.' : !opts.venueIdentity ? ' Ingen fotobeskrivning tillgänglig — använd konceptankare och platsidentitet från VARUMÄRKESRÖST-blocket som ditt konkreta fundament.' : ''}
\`,
    de: \`⚠️ ERÖFFNUNGSREGEL FÜR DIESEN BEITRAG: Die Schreibregeln der Marke erfordern konkrete Eröffnungen. Dein erster Satz MUSS in einem Element verankert sein, das du in \${hasVenueAnchor ? 'der ANKER-Zeile in INHALT (die bestätigte Tatsache)' : '📸 PRIMÄRE FAKTENQUELLE'}, INHALT oder dem MARKENSTIMME-Block nachweisen kannst. Abstrakte Stimmung ("die Wärme breitet sich aus", "die Stille senkt sich herab") ist keine Quelle — das ist eine generische Halluzination.\${hasVenueAnchor ? ' Die ANKER-Zeile ist Ihre primäre Faktenquelle — nutzen Sie sie.' : !opts.venueIdentity ? ' Keine Fotobeschreibung verfügbar — nutze Konzeptanker und Ortsidentität aus dem MARKENSTIMME-Block als konkretes Fundament.' : ''}
\`,`;

const NEW2 = `    da: \`⚠️ ÅBNINGSREGEL FOR DETTE OPSLAG: Brandets skriveregler kræver konkrete åbninger. Din første sætning SKAL være forankret i ét element du kan pege på i \${hasVenueAnchor ? 'ANKER-linjen i INDHOLD (det bekræftede faktum)' : primarySourceLabel}, INDHOLD eller BRANDSTEMME-blokken. Abstrakt stemning ("varmen spreder sig", "stilheden falder ind", "aftenen folder sig ud") er ikke en kilde — det er en generisk hallucination.\${hasVenueAnchor ? ' ANKER-linjen er din primære faktakilde — brug den.' : noPhotoDataAtAll ? ' Ingen fotobeskrivelse er tilgængelig — brug konceptankre og stedsidentitet fra BRANDSTEMME-blokken som dit konkrete fundament.' : ''}
\`,
    sv: \`⚠️ ÖPPNINGSREGEL FÖR DETTA INLÄGG: Varumärkets skrivinstruktioner kræver konkrete åbninger. Din første mening MÅSTE vara förankrad i ett element du kan peka på i \${hasVenueAnchor ? 'ANKAR-raden i INNEHÅLL (det bekräftade faktumet)' : primarySourceLabel}, INNEHÅLL eller VARUMÄRKESRÖST-blocket. Abstrakt stämning ("värmen sprider sig", "tystnaden infinner sig") är inte en källa — det är en generisk hallucination.\${hasVenueAnchor ? ' ANKAR-raden är din primära faktakälla — använd den.' : noPhotoDataAtAll ? ' Ingen fotobeskrivning tillgänglig — använd konceptankare och platsidentitet från VARUMÄRKESRÖST-blocket som ditt konkreta fundament.' : ''}
\`,
    de: \`⚠️ ERÖFFNUNGSREGEL FÜR DIESEN BEITRAG: Die Schreibregeln der Marke erfordern konkrete Eröffnungen. Dein erster Satz MUSS in einem Element verankert sein, das du in \${hasVenueAnchor ? 'der ANKER-Zeile in INHALT (die bestätigte Tatsache)' : primarySourceLabel}, INHALT oder dem MARKENSTIMME-Block nachweisen kannst. Abstrakte Stimmung ("die Wärme breitet sich aus", "die Stille senkt sich herab") ist keine Quelle — das ist eine generische Halluzination.\${hasVenueAnchor ? ' Die ANKER-Zeile ist Ihre primäre Faktenquelle — nutzen Sie sie.' : noPhotoDataAtAll ? ' Keine Fotobeschreibung verfügbar — nutze Konzeptanker und Ortsidentität aus dem MARKENSTIMME-Block als konkretes Fundament.' : ''}
\`,`;

if (!content.includes(OLD2)) { console.error('NOT FOUND (template literals)'); process.exit(1); }
content = content.replace(OLD2, NEW2);

fs.writeFileSync(path, content, 'utf8');
console.log('OK');
