// lang-strings.ts
// ══════════════════════════════════════════════════════════════════════════
// Language-keyed prompt strings for generate-text-from-idea.
//
// ⚠️ CLEANED VERSION - Phase 2 Token Optimization
// Removed 22 unused exports (250+ lines saved, ~14KB reduction)
//
// HOW TO ADD A NEW LANGUAGE
// 1. Add the key to SupportedLanguage below (e.g. 'fi').
// 2. TypeScript will immediately surface every Record that is missing the key.
// 3. Fill in every entry. If a translation is not yet available, copy 'da' as
//    a placeholder and note it with // TODO: translate.
// ══════════════════════════════════════════════════════════════════════════

export type SupportedLanguage = 'da' | 'sv' | 'de'

// ── Goal directives ────────────────────────────────────────────────────────

export const GOAL_DIRECTIVE_MAP: Record<string, Record<string, string>> = {
  drive_footfall: {
    da: 'Formål: Skab lyst til at besøge stedet nu eller inden for de næste dage — teksten skal føles som en konkret, oprigtig invitation.\nSkrivestil: Tidsforankret (i dag, i aften, denne uge) · konkret og handlingsrettet · fortæl hvad der er nu, ikke hvad der måske er engang — ingen abstrakt stemning, ingen generisk ros af stedet.',
    sv: 'Syfte: Skapa lust att besöka stället nu eller inom de närmaste dagarna — texten ska kännas som en konkret, uppriktig inbjudan.\nSkrivsätt: Tidsförankrad (idag, ikväll, den här veckan) · konkret och handlingsinriktad · berätta vad som händer nu, inte vad som möjligtvis händer en gång.',
    de: 'Zweck: Lust wecken, den Ort jetzt oder in den nächsten Tagen zu besuchen — der Text soll wie eine konkrete, aufrichtige Einladung wirken.\nSchreibstil: Zeitverankert (heute, heute Abend, diese Woche) · konkret och handlingsorientiert · erzähle was jetzt da ist — keine abstrakte Stimmung, kein generisches Lob des Ortes.',
  },
  build_brand: {
    da: 'Formål: Styrk stedets identitet og udtryk — ikke sælg et besøg, men fortæl hvem dette sted er. Brandstemmen er pointen med dette opslag.\nSkrivestil: Identitetsbærende · ét billede eller én kvalitet er nok — gå i dybden frem for i bredden · ingen visit-energi, ingen booking-pres — lad stedet tale om sig selv.',
    sv: 'Syfte: Stärk platsens identitet och uttryck — sälj inte ett besök, berätta vem detta ställe är. Varumärkesstemman är poängen med det här inlägget.\nSkrivsätt: Identitetsbärande · en bild eller en kvalitet räcker — gå på djupet snarare än på bredden · ingen visit-energi, inget bokningtryck — låt platsen tala för sig själv.',
    de: 'Zweck: Stärke die Identität und den Ausdruck des Ortes — verkaufe keinen Besuch, erzähle, wer dieser Ort ist. Die Markenstimme ist der Kern dieses Beitrags.\nSchreibstil: Identitätstragend · ein Bild oder eine Eigenschaft reicht — Tiefe statt Breite · keine Besuchsenergie, kein Buchungsdruck — lass den Ort für sich sprechen.',
  },
  retain_loyalty: {
    da: 'Formål: Tal direkte til faste gæster — skriv som om du taler til nogen der allerede kender stedet og føler sig hjemme her.\nSkrivestil: Insider-register · antag fælles kontekst, forklar ikke det åbenlyse · kontinuitet snarere end nyhed — det der altid er godt, eller det der er tilbage igen · ingen præsentation af stedet, ingen intro-sætninger.',
    sv: 'Syfte: Tala direkt till stamgäster — skriv som om du talar till någon som redan känner stället och känner sig hemma där.\nSkrivsätt: Insider-register · anta gemensam kontext, förklara inte det uppenbara · kontinuitet snarare än nyhet — det som alltid är bra, eller det som är tillbaka igen.',
    de: 'Zweck: Sprich direkt zu Stammgästen — schreibe, als würden du mit jemandem sprechen, der den Ort bereits kennt und sich dort zu Hause fühlt.\nSchreibstil: Insider-Register · nehme gemeinsamen Kontext an, erkläre nicht das Offensichtliche · Kontinuität statt Neuheit — was immer gut ist, oder was wieder da ist.',
  },
}

export const ACTIVATION_MAP: Record<string, string> = {
  da: 'Brug brandets stemme til at gøre netop denne idé til en naturlig, konkret ytring fra denne virksomhed — ikke et generisk AI-opslag der kunne komme fra hvem som helst.',
  sv: 'Använd varumärkets röst för att göra just den här idén till ett naturligt, konkret uttryck från detta företag — inte ett generiskt AI-inlägg som kunde komma från vem som helst.',
  de: 'Nutze die Markenstimme, um genau diese Idee zu einem natürlichen, konkreten Ausdruck dieses Unternehmens zu machen — kein generischer KI-Beitrag, der von jedem kommen könnte.',
}

// ── Content-type hints ─────────────────────────────────────────────────────

export const VENUE_ANCHOR_PROTAGONIST_HINT: Record<string, string> = {
  da: 'ANKER ER PROTAGONISTEN: ANKER-linjen i INDHOLD er et bekræftet faktum om stedet (service, rum eller åbningstider). Byg posten rundt om dette — ligesom retten er protagonist i et menu-opslag.\n- Åbningen MÅ tage afsæt i ANKER, ikke i STEMNING-linjen (som er ideens titel, ikke en åbningssætning)\n- Ét led fra ANKER skal optræde konkret og direkte i teksten\n- Opfind IKKE stedsdetaljer ud over hvad ANKER og BRANDSTEMME-blokken angiver\n',
  sv: 'ANKARET ÄR PROTAGONISTEN: ANKAR-raden i INNEHÅLL är ett bekräftat faktum om stället (service, lokal eller öppettider). Bygg inlägget runt detta — precis som rätten är protagonist i ett menyinlägg.\n- Öppningen MÅSTE ta utgångspunkt i ANKAR, inte i STÄMNING-raden\n- En del från ANKAR måste förekomma konkret och direkt i texten\n- Uppfinn INTE platsdetaljer utöver vad ANKAR och VARUMÄRKESRÖST-blocket anger\n',
  de: 'ANKER IST DER PROTAGONIST: Die ANKER-Zeile in INHALT ist eine bestätigte Tatsache über den Ort (Service, Raum oder Öffnungszeiten). Baue den Beitrag darum auf — genau wie das Gericht bei einem Menü-Beitrag der Protagonist ist.\n- Die Eröffnung MUSS vom ANKER ausgehen, nicht von der STIMMUNG-Zeile\n- Ein Teil des ANKERS muss konkret und direkt im Text vorkommen\n- Erfinde KEINE Ortsdetails außer dem, was ANKER und MARKENSTIMME-Block angeben\n',
}

export const AI_IDEAS_BEHIND_SCENES_NO_PHOTO_HINT: Record<string, string> = {
  da: `⚠️ BEHIND THE SCENES (ingen fotodokumentation): Intet visuelt interiør er dokumenteret — opfind IKKE vinduer, gulve, lys eller lyde. Åbn med HANDLINGEN fra INDHOLD. Se krav nedenfor.`,
  sv: `⚠️ BEHIND THE SCENES (ingen fotodokumentation): Intet visuellt interiör är dokumenterat — uppfinn INTE fönster, golv, ljus eller ljud. Öppna med HANDLINGEN från INNEHÅLL. Se krav nedan.`,
  de: `⚠️ BEHIND THE SCENES (keine Fotodokumentation): Kein visuelles Interieur dokumentiert — erfinde KEINE Fenster, Böden, Licht oder Geräusche. Öffne mit der HANDLUNG aus INHALT. Siehe Anforderungen unten.`,
}

export const ATMOSPHERE_NO_PHOTO_HINT: Record<string, string> = {
  da: `⚠️ ATMOSFÆRE (ingen fotodokumentation): Intet visuelt interiør er dokumenteret for dette sted — opfind ALDRIG møbler (borde, stole), vinduer, lysforhold, farver, materialer, designstil, interiørdetaljer eller navne på personer/ansatte. Åbn med en menneskelig aktivitet (brug "vi" eller passiv: "vi brygger din kaffe", "kaffen brygges med omhu"), et konkret tidspunkt eller en anledning fra INDHOLD og BRANDSTEMME-blokken — ALDRIG med opdigtede navne eller beskrivelser af rummet.`,
  sv: `⚠️ ATMOSFÄR (ingen fotodokumentation): Inget visuellt interiör är dokumenterat för den här platsen — uppfinn ALDRIG möbler (bord, stolar), fönster, ljusförhållanden, färger, material, designstil, interiördetaljer eller namn på personer/anställda. Öppna med en mänsklig aktivitet (använd "vi" eller passiv: "vi brygger ditt kaffe", "kaffet bryggs med omsorg"), ett konkret tillfälle eller en tidpunkt från INNEHÅLL och VARUMÄRKESRÖST-blocket — ALDRIG med påhittade namn eller rumsbeskrivning.`,
  de: `⚠️ ATMOSPHÄRE (keine Fotodokumentation): Kein visuelles Interieur ist für diesen Ort dokumentiert — erfinde NIEMALS Möbel (Tische, Stühle), Fenster, Lichtverhältnisse, Farben, Materialien, Designstil, Innenraumdetails oder Namen von Personen/Mitarbeitern. Öffne mit einer menschlichen Aktivität (verwende "wir" oder Passiv: "wir brühen deinen Kaffee", "der Kaffee wird mit Sorgfalt gebrüht"), einem konkreten Zeitpunkt oder einem Anlass aus INHALT und dem MARKENSTIMME-Block — NIEMALS mit erfundenen Namen oder einer Raumbeschreibung.`,
}

// ── CTA labels ─────────────────────────────────────────────────────────────

export const CTA_HEADER_STRICT: Record<string, string> = {
  da: 'FAST CTA (skal stå til sidst, ordret):',
  sv: 'FAST CTA (ska stå sist, ordagrant):',
  de: 'FESTER CTA (muss am Ende stehen, wörtlich):',
}

export const CTA_HEADER_FLEX: Record<string, string> = {
  da: 'AFSLUTNING — integrer naturligt i teksten:',
  sv: 'AVSLUTNING — integrera naturligt i texten:',
  de: 'ABSCHLUSS — integriere natürlich in den Text:',
}

export const CTA_RULE_STRICT: Record<string, string> = {
  da: 'Slut altid med CTA-linjen',
  sv: 'Avsluta alltid med CTA-raden',
  de: 'Beende immer mit der CTA-Zeile',
}

export const CTA_RULE_FLEX: Record<string, string> = {
  da: 'Afslut med teksten herover — intentionen og emojis bevares, let omformulering tilladt',
  sv: 'Avsluta med texten ovan — intentionen och emojis bevaras, lätt omformulering tillåten',
  de: 'Beende mit dem Text oben — Intention und Emojis bleiben, leichte Umformulierung erlaubt',
}

// ── Weekly Plan role framing ───────────────────────────────────────────────

export const WP_ROLE_FRAME_MAP: Record<string, Record<string, string>> = {
  drive_footfall: {
    da: 'Teksten er vellykket hvis læseren tænker: "det gider jeg prøve nu" — og handler på det.',
    sv: 'Texten är lyckad om läsaren tänker: "det vill jag prova nu" — og agerar på det.',
    de: 'Der Text ist gelungen, wenn der Leser denkt: "das will ich jetzt ausprobieren" — und handelt.',
  },
  build_brand: {
    da: 'Teksten er vellykket hvis læseren genkender noget ægte og specifikt ved dette sted — ikke bare et velskrevet opslag.',
    sv: 'Texten är lyckad om läsaren känner igen något äkta och specifikt med det här stället — inte bara ett välskrivet inlägg.',
    de: 'Der Text ist gelungen, wenn der Leser etwas Echtes und Spezifisches an diesem Ort erkennt — nicht nur einen gut geschriebenen Beitrag.',
  },
  retain_loyalty: {
    da: 'Teksten er vellykket hvis en fast gæst nikker genkendende — og føler sig set, ikke solgt til.',
    sv: 'Texten är lyckad om en stamgäst nickar igenkännande — och känner sig sedd, ikke säld til.',
    de: 'Der Text ist gelungen, wenn ein Stammgast zustimmend nickt — und sich gesehen, nicht angesprochen fühlt.',
  },
}

// ══════════════════════════════════════════════════════════════════════════
// 5 PRINCIPLES — replaces 47 prohibition strings
// ══════════════════════════════════════════════════════════════════════════

export const FIVE_PRINCIPLES: Record<string, string> = {
  da: `PRINCIPPER (gælder hele teksten)
P1 KILDETRO: Hvert substantiv, rekvisit og stedsdetalje skal kunne peges tilbage til INDHOLD, SCENE-DETALJE eller 📸 FAKTAKILDE. Kan du ikke pege → slet. Brandeksemplers scener er IKKE facts om dette opslag. Stednavne er lokationsmarkører — ikke tilladelse til at opfinde udsigt, vejr eller lyd.
P2 KONKRET-FØRST: Åbn med noget læseren kan se, smage eller gøre — aldrig med abstrakt stemning. "Dampende gryde med kraftig kødsauce" slår "Varmen spreder sig". Sætninger med kun subjekt + intransitivt verb ("X venter", "X kalder") er scenefylde — forbudt.
P3 GÆSTENS PERSPEKTIV: Gæsten oplever rummet — rummet agerer ikke. Fysiske træk (vinduer, lys, gulve) er stedsbestemmelser, aldrig sætningssubjekt. "Man sidder i naturligt lys" — ikke "Lyset fylder rummet".
P4 NATURLIGT DANSK: Skriv som en dansker. Undgå: "lækker", "hyggelig", "autentisk", "unik", "Svip forbi", "nyd" som imperativ åbning, "Vi ses", "Vi venter", "Velkommen til X". Aldrig " — " som bindeled. Afslut med CTA, intet efter.
P5 BRANDREGISTER: Udtryk facts i brandets eget korte register — "træborde og metalstole", ikke "en kontrast mellem varme trætoner og kølige metalstrukturer". Analytiske beskrivelser fra faktakilder skal oversættes til brandets stemme.`,

  sv: `PRINCIPER (gäller hela texten)
P1 KÄLLTRO: Varje substantiv, rekvisita och platsdetalj ska kunna spåras till INNEHÅLL, SCEN-DETALJ eller 📸 FAKTAKÄLLA. Kan du inte peka → ta bort. Varumärkesexemplens scener är INTE fakta om detta inlägg.
P2 KONKRET-FÖRST: Öppna med något läsaren kan se, smaka eller göra — aldrig med abstrakt stämning. Meningar med bara subjekt + intransitivt verb är förbjudna.
P3 GÄSTENS PERSPEKTIV: Gästen upplever lokalen — lokalen agerar inte. Fysiska drag är platsbestämningar, aldrig satssubjekt.
P4 NATURLIG SVENSKA: Undvik: "läcker", "mysig", "autentisk", "unik". Aldrig " — " som bindeled. Avsluta med CTA.
P5 VARUMÄRKESREGISTER: Uttryck fakta i varumärkets eget korta register — inte i analytisk stil.`,

  de: `PRINZIPIEN (gelten für den ganzen Text)
P1 QUELLENTREU: Jedes Substantiv, Requisit und Ortsdetail muss auf INHALT, SZENEN-DETAIL oder 📸 FAKTENQUELLE zurückführbar sein. Kannst du nicht zeigen → streichen. Szenen aus Markenbeispielen sind KEINE Fakten über diesen Beitrag.
P2 KONKRET-ZUERST: Öffne mit etwas, das der Leser sehen, schmecken oder tun kann — nie mit abstrakter Stimmung. Sätze mit nur Subjekt + intransitivem Verb sind verboten.
P3 GÄSTEPERSPEKTIVE: Der Gast erlebt den Raum — der Raum handelt nicht. Physische Merkmale sind Ortsangaben, nie Satzsubjekt.
P4 NATÜRLICHES DEUTSCH: Vermeide: "lecker", "gemütlich", "authentisch", "einzigartig". Nie " — " als Bindung. Beende mit CTA.
P5 MARKENREGISTER: Drücke Fakten im eigenen kurzen Register der Marke aus — nicht in analytischem Stil.`,
}

// ══════════════════════════════════════════════════════════════════════════
// GOLD EXAMPLES — 2 per content type
// ══════════════════════════════════════════════════════════════════════════

export const GOLD_EXAMPLES: Record<string, Record<string, string>> = {
  menu: {
    da: `EKSEMPLER PÅ GOD TEKST (menu):
✅ "Saftige boller af langtidshævet dej, gylden skorpe og et indre blødt som dun. Lige ud af ovnen hver morgen kl. 7 🥐 Bestil din morgenmad"
✅ "Tyk, dampende gullasch med paprika og oksekød der falder fra hinanden. Serveret med friskbagt surdejsbrød 🍲 Sig til — vi sætter den af"
↑ Mønster: rettens sansekvalitet FØRST → ét konkret tilbud → CTA. Ingen lokation, ingen stemning, ingen "nyd".`,
  },
  behind_scenes: {
    da: `EKSEMPLER PÅ GOD TEKST (behind the scenes):
✅ "Kl. 6 ruller de første plader ind i ovnen. 200 croissanter folder sig ud inden I banker på døren ☀️ Vi bager — I nyder"
✅ "Tre kasser blåmuslinger fra Limfjorden. Vi sorterer, skrubber og fylder gryderne — i aften er de stjernerne på tallerkenen 🐚 Book bord"
↑ Mønster: konkret handling i nutid FØRST → hvad det bliver til → CTA. Ingen rum-poesi, ingen materialer.`,
  },
  atmosphere: {
    da: `EKSEMPLER PÅ GOD TEKST (atmosfære):
✅ "De bestilte kaffe til to. Tre timer senere sad de stadig der 🙂 Det er den slags eftermiddage vi er klar til — åbent til kl. 22"
✅ "Hun tog en pause fra arbejdet. Frokost, et glas vand og en halv time uden skærm 🍷 Se hvad vi har til frokost"
↑ Mønster: PERSON/GÆST er grammatisk subjekt i første sætning → konkret handling eller tidspunkt → CTA. Rummet er baggrund — aldrig sætningssubjekt.`,
  },
}

// ── Content-path templates ─────────────────────────────────────────────────

export const PATH_TEMPLATE_MENU: Record<string, string> = {
  da: `RETTENS ROLLE: Du skriver en social media-tekst, IKKE et menukort. Beskriv rettens karakter: giv den personlighed med sansedetaljer (syn, tekstur, temperatur, duft).
- Max 2 konkrete elementer fra retten (fremhæv det mest appetitlige, IKKE alle komponenter)
- Ingredienser og elementer fra INDHOLD MÅ gerne nævnes (beskriv dem med karakter, ikke som en liste)
- Opfind ALDRIG ingredienser, tilbehør, saucer eller tilberedning der IKKE fremgår af INDHOLD
- Sansedetalje: {sensoryRule}
- FORBUDT: opremsning i menukort-stil ("serveres med X, Y og Z"), generisk madanmeldersprog, sekventiel gennemgang af alle retter/elementer
- ⛔ FORBUDT første linje: gengive titlens emne eller ordlyd. Titlen opsummerer; tekstens første linje skal fremføre NYT indhold: en ingrediens, en tilberedning, et klokkeslet eller en konkret handling.
- ⛔ FORBUDT OVERALT: " - " eller " – " som stilistisk binding mellem sætningsdele ("frisk mad - godt selskab - kom forbi") er et AI-signal. Brug naturlig sætningsstruktur.
- Rettens sansekvalitet er pointen; lokation og stemning er sekundært`,
  sv: `RÄTTENS ROLL: Du skriver en social media-text, INTE en menytext. Beskriv rättens karaktär: ge den personlighet med sinnesdetaljer.
- Använd KUN egenskaper som är naturligt sanna för denna typ utifrån INNEHÅLL
- Sinnesdetalj: {sensoryRule}
- FÖRBJUDET: uppräkning av ingredienser i listform`,
  de: `ROLLE DES GERICHTS: Du schreibst einen Social-Media-Text, KEINE Speisekarte. Beschreibe den Charakter des Gerichts: gib ihm Persönlichkeit mit Sinnesdetails.
- Verwende NUR Eigenschaften die für diesen Typ natürlich zutreffend sind
- Sinnesdetail: {sensoryRule}
- VERBOTEN: Aufzählung von Zutaten in Listenform`,
}

export const PATH_TEMPLATE_SCENE: Record<string, string> = {
  da: `BEHIND THE SCENES: Åbn med handlingen: hvad tilberedes, hvad sker, hvad gøres klar (første person, nutid).
- Max ét rum-element tørt som lokation
- FORBUDT: stemningspoesi fra rum-facts ("solens stråler danser", "lyset flyder", "aromaen breder sig")
- ⛔ FORBUDT OVERALT: " - " eller " – " som stilistisk binding mellem sætningsdele er et AI-signal. Brug naturlig sætningsstruktur.
- Skriv i brandets stemme, ikke i analytisk stil`,
  sv: `BEHIND THE SCENES: Öppna med handlingen: vad lagas, vad händer (första person, presens).
- Max ett rumelement torrt som plats
- FÖRBJUDET: stämningspoesi från rumfakta`,
  de: `BEHIND THE SCENES: Öffne mit der Handlung: was wird zubereitet, was passiert (erste Person, Präsens).
- Max ein Raumelement trocken als Ort
- VERBOTEN: Stimmungspoesie aus Raumfakten`,
}

export const PATH_TEMPLATE_ATMOSPHERE: Record<string, string> = {
  da: `ATMOSFÆRE: Gæsten er sætningssubjektet; rummet er baggrund.
- Fysiske træk fra faktakilder (lys, vinduer, gulve) må KUN optræde som stedsbestemmelser, ALDRIG som sætningssubjekt
- Åbn med menneskelig aktivitet, konkret tidspunkt eller anledning (IKKE med en rumsbeskrivelse)
- Opfind ALDRIG møbler, vinduer, lysforhold, materialer eller interiørdetaljer der ikke er dokumenteret
- ⛔ FORBUDT OVERALT: " - " eller " – " som stilistisk binding mellem sætningsdele er et AI-signal. Brug naturlig sætningsstruktur.`,
  sv: `ATMOSFÄR: Gästen är satssubjektet; lokalen är bakgrund.
- Fysiska drag får KUN uppträda som platsbestämningar, ALDRIG som satssubjekt
- Öppna med mänsklig aktivitet eller tidpunkt (INTE med rumsbeskrivning)`,
  de: `ATMOSPHÄRE: Der Gast ist das Satzsubjekt; der Raum ist Hintergrund.
- Physische Merkmale dürfen NUR als Ortsangaben erscheinen, NIEMALS als Satzsubjekt
- Öffne mit menschlicher Aktivität oder Zeitpunkt (NICHT mit Raumbeschreibung)`,
}
