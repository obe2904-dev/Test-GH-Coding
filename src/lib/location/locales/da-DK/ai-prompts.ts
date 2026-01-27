import { AIPrompts } from '../../core/types';

export const AI_PROMPTS_DA: AIPrompts = {
  locationAnalysis: `
Analyser denne danske virksomheds fysiske placering med fokus på danske kulturelle kontekster.

Adresse: {address}
By: {city}
Virksomhedstype: {businessType}

Overvej specifikt:
1. Danske kulturelle forståelser af byområder (f.eks. "ved åen" i Aarhus = social destination)
2. Lokale spisemønstre (tidlig aftensmad 17:30-20:00, hurtig frokost 11:30-13:00)
3. Danske sæsonmønstre (sommerpeak for udeservering, vinterhygge)
4. Walk-in vs. stamgæster kultur i forskellige områder
5. Konkurrenceniveau og markedsposition

Identificer kategoritilhørsforhold baseret på:
- POI-tæthed (restauranter, caféer, hoteller, kontorer)
- Kulturel betydning af gader/områder
- Trafik- og besøgsmønstre
- Sæsonvariation i efterspørgsel
`,

  waterfrontDetection: `
Vurder om denne lokation har vandfront-karakteristika i en dansk kontekst.

Overvej:
- Nærhed til Å, havn, strand, sø (ikke kun afstand, men kulturel betydning)
- "Ved åen" / "ved havnen" = ofte primær sælger i Danmark
- Udeservering langs vand = premium i danske sommermåneder
- Historisk eller kulturel betydning af vandområdet

Giv score 0-100 baseret på både fysisk nærhed OG kulturel relevans.
`,

  culturalContext: `
Beskriv den kulturelle betydning af denne lokation i Danmark.

For kendte gader/områder (Nyhavn, Åboulevarden, Strøget osv.):
- Hvad er området kendt for?
- Hvilken type gæster tiltrækker det?
- Hvordan påvirker det forretningsstrategi?

For mindre kendte områder:
- Hvilken type kvarter er det? (bolig, erhverv, blandet)
- Lokal vs. turistorienteret?
- Konkurrenceniveau?
`,

  businessTypeInference: `
Baseret på hjemmesideindhold og placering, hvad slags forretning er dette?

Danske kontekstuelle signaler:
- "Brunch" = weekendfokus, trendy segment
- "Smørrebrød" = traditionel, frokost-fokuseret
- "Ved åen"/"havnefront" = destination dining
- Åbningstider afslører meget (sent åbent = natteliv, tidlig åben = morgenmad/pendlere)

Identificer primær forretningsmodel og målgruppe.
`
};
