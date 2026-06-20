/**
 * Denmark Country Profile (DK)
 *
 * Climate data: DMI (Danish Meteorological Institute) 1991–2020 climate normals, Copenhagen reference.
 * Seasonal ingredients: Danish seasonal produce calendar (field production, not greenhouse imports).
 *
 * Copenhagen 56°N is the reference point. Jutland west coast is slightly milder in winter;
 * adjust avg_max_temp ±1°C for regional variants if needed.
 */

import type { CountryProfile } from './interfaces.ts';

export const DK_COUNTRY_PROFILE: CountryProfile = {
  country_code: 'DK',

  climate_baseline: {
    1:  { avg_max_temp: 3,  avg_min_temp: -1, avg_rain_days: 13, outdoor_viable: false, baseline_label: 'januar dk: 3°C maks — vintervejr, udendørsdrift ikke normalt' },
    2:  { avg_max_temp: 4,  avg_min_temp: -1, avg_rain_days: 11, outdoor_viable: false, baseline_label: 'februar dk: 4°C maks — normalt vinterkoldt' },
    3:  { avg_max_temp: 7,  avg_min_temp: 1,  avg_rain_days: 12, outdoor_viable: false, baseline_label: 'marts dk: 7°C maks — kold forårsmåned, udeservering ikke normalt' },
    4:  { avg_max_temp: 12, avg_min_temp: 4,  avg_rain_days: 11, outdoor_viable: false, baseline_label: 'april dk: 12°C maks — foråret begynder men udeservering ikke normalt endnu' },
    5:  { avg_max_temp: 16, avg_min_temp: 8,  avg_rain_days: 10, outdoor_viable: true,  baseline_label: 'maj dk: 16°C maks — første måned med mulig udeservering ved sol og vindstille' },
    6:  { avg_max_temp: 20, avg_min_temp: 12, avg_rain_days: 10, outdoor_viable: true,  baseline_label: 'juni dk: 20°C maks — god udeserveringsperiode' },
    7:  { avg_max_temp: 22, avg_min_temp: 14, avg_rain_days: 12, outdoor_viable: true,  baseline_label: 'juli dk: 22°C maks — højsæson for udeservering' },
    8:  { avg_max_temp: 22, avg_min_temp: 14, avg_rain_days: 13, outdoor_viable: true,  baseline_label: 'august dk: 22°C maks — fortsat højsæson for udeservering' },
    9:  { avg_max_temp: 17, avg_min_temp: 10, avg_rain_days: 13, outdoor_viable: true,  baseline_label: 'september dk: 17°C maks — sensommer, udeservering mulig ved sol' },
    10: { avg_max_temp: 13, avg_min_temp: 7,  avg_rain_days: 14, outdoor_viable: false, baseline_label: 'oktober dk: 13°C maks — udeservering ikke normalt' },
    11: { avg_max_temp: 7,  avg_min_temp: 3,  avg_rain_days: 15, outdoor_viable: false, baseline_label: 'november dk: 7°C maks — vintervejr, indendørs er normen' },
    12: { avg_max_temp: 4,  avg_min_temp: 1,  avg_rain_days: 14, outdoor_viable: false, baseline_label: 'december dk: 4°C maks — vintervejr, december-stemning dominerer' },
  },

  season_calendar: {
    1: {
      current: 'winter',
      ingredients: [
        { name: 'kål',        content_hook: 'vinterkål er i sæson' },
        { name: 'rodfrugter', content_hook: 'rodfrugter fra lager' },
        { name: 'selleri',    content_hook: 'vinterkøkken med selleri' },
        { name: 'porrer',     content_hook: 'porrer er i sæson' },
      ],
      behavioral_signals: [
        'koldt vintervejr driver kaffepause-besøg indendørs',
        'indendørs opholdskvalitet er det primære besøgsargument',
      ],
      unavailable_false_positives: ['jordbær', 'tomater', 'agurk', 'asparges', 'spinat', 'hindbær'],
    },
    2: {
      current: 'winter',
      ingredients: [
        { name: 'kål',           content_hook: 'vinterkål er fortsat i sæson' },
        { name: 'rodfrugter',    content_hook: 'vinterrodfrugter' },
        { name: 'pærer',         content_hook: 'lagrede pærer' },
        { name: 'citrusfrugter', content_hook: 'importerede citroner og appelsiner' },
      ],
      behavioral_signals: [
        'koldt vintervejr driver indendørsbesøg',
        'februar er årets korteste og mindst spontane måned',
      ],
      unavailable_false_positives: ['jordbær', 'hindbær', 'tomater', 'asparges', 'agurk'],
    },
    3: {
      current: 'spring',
      ingredients: [
        { name: 'forårsløg', content_hook: 'de første forårsløg dukker op' },
        { name: 'spinat',    content_hook: 'tidlig spinat fra drivhus' },
        { name: 'radiser',   content_hook: 'drivhusradiser' },
        { name: 'ramsløg',   content_hook: 'ramsløg ved månedsskiftet' },
      ],
      behavioral_signals: [
        'foråret er begyndt men temperaturer er fortsat lave (7°C normalt) — endnu ikke udendørsvejr',
        'dagslyset forlænges markant — stemningen vender mod forår men indendørs er normen',
      ],
      unavailable_false_positives: ['tomater', 'agurk', 'jordbær', 'asparges', 'nye kartofler'],
    },
    4: {
      current: 'spring',
      ingredients: [
        { name: 'asparges',  content_hook: 'aspargessæsonen starter sidst i april' },
        { name: 'ramsløg',   content_hook: 'ramsløg er i fuld sæson' },
        { name: 'rabarber',  content_hook: 'rabarbersæsonen begynder' },
        { name: 'spinat',    content_hook: 'frilands-spinat begynder' },
      ],
      behavioral_signals: [
        'foråret er begyndt men temperaturer er fortsat lave (12°C normalt) — endnu ikke udendørsvejr',
        'aspargessæsonen nærmer sig — en konkret sæsonankring der gælder netop april',
        'øget dagslys og forårsenergi øger spontane beslutninger om at komme ud — normalt til indendørsbesøg',
      ],
      unavailable_false_positives: ['tomater', 'agurk', 'jordbær', 'hindbær', 'nye kartofler'],
    },
    5: {
      current: 'spring',
      ingredients: [
        { name: 'asparges',      content_hook: 'højsæson for danske asparges' },
        { name: 'jordbær',       content_hook: 'de første jordbær fra drivhus' },
        { name: 'rabarber',      content_hook: 'rabarber er i fuld sæson' },
        { name: 'nye kartofler', content_hook: 'de nye kartofler er på vej' },
        { name: 'ramsløg',       content_hook: 'ramsløg slutter sidst i maj' },
      ],
      behavioral_signals: [
        'maj er forårets varmeste måned — udeservering mulig ved sol og vindstille',
        'asparges- og jordbærsæsonen forstærker sæsonfortællingen konkret',
        'stigende spontanitet og udeliv med de første varme dage',
      ],
      unavailable_false_positives: ['tomater', 'agurk'],
    },
    6: {
      current: 'summer',
      ingredients: [
        { name: 'jordbær',       content_hook: 'jordbærsæsonen er i gang' },
        { name: 'ærter',         content_hook: 'de første danske ærter' },
        { name: 'hindbær',       content_hook: 'de første hindbær' },
        { name: 'tomater',       content_hook: 'danske tomater fra drivhus' },
        { name: 'nye kartofler', content_hook: 'nye kartofler i sæson' },
        { name: 'agurk',         content_hook: 'danske agurker' },
      ],
      behavioral_signals: [
        'højsæson og turistflow begynder',
        'lune aftener forstærker terrassebesøg og spontane aftenbesøg',
        'feriemodus og spontane udendørsbesøg dominerer',
      ],
      unavailable_false_positives: ['kål', 'rodfrugter'],
    },
    7: {
      current: 'summer',
      ingredients: [
        { name: 'hindbær',  content_hook: 'hindbær er i sæson' },
        { name: 'blåbær',   content_hook: 'vilde blåbær' },
        { name: 'tomater',  content_hook: 'danske tomater i fuld sæson' },
        { name: 'zucchini', content_hook: 'zucchini og squash' },
        { name: 'majs',     content_hook: 'tidlige majskolber' },
      ],
      behavioral_signals: [
        'juli er højsommer — turistflow og feriemodus dominerer',
        'lune aftener og lange lyse dage driver udebesøg',
        'spontane besøg og gruppebesøg dominerer',
      ],
      unavailable_false_positives: [],
    },
    8: {
      current: 'summer',
      ingredients: [
        { name: 'blommetomater', content_hook: 'blommetomater i topform' },
        { name: 'majs',          content_hook: 'frisk majs i sæson' },
        { name: 'figner',        content_hook: 'tidlige figner' },
        { name: 'svampe',        content_hook: 'de første svampe' },
        { name: 'blommer',       content_hook: 'friske blommer' },
      ],
      behavioral_signals: [
        'august er sensommer — stadig varm men med aftagende turistflow',
        'udeservering fortsat i høj sæson',
        'back-to-school-stemning sidst i august ændrer publikumsmikset',
      ],
      unavailable_false_positives: [],
    },
    9: {
      current: 'autumn',
      ingredients: [
        { name: 'svampe',  content_hook: 'svampesæsonen er i gang' },
        { name: 'æbler',   content_hook: 'danske æbler i sæson' },
        { name: 'pærer',   content_hook: 'efterårets pærer' },
        { name: 'blommer', content_hook: 'blommer og mirabeller' },
        { name: 'græskar', content_hook: 'de første græskar' },
      ],
      behavioral_signals: [
        'faldende temperatur øger indendørsbesøg fra midten af måneden',
        'svampe og æbler giver stærke konkrete sæsonankringer',
        'kortere dagslys begynder at reducere spontane aftenbesøg',
      ],
      unavailable_false_positives: ['tomater', 'agurk'],
    },
    10: {
      current: 'autumn',
      ingredients: [
        { name: 'græskar',    content_hook: 'græskar er i sæson' },
        { name: 'svampe',     content_hook: 'svampesæsonen er på toppen' },
        { name: 'æbler',      content_hook: 'æbler og cider' },
        { name: 'vildand',    content_hook: 'jagtens tid — vildand på kortet' },
        { name: 'kål',        content_hook: 'de første vinterkål' },
      ],
      behavioral_signals: [
        'oktober — køligere og regnfuldt vejr driver comfort food-efterspørgsel',
        'udeservering ikke normalt — indendørs stemning dominerer',
        'kortere dagslys øger kaffepause-besøg i dagtimerne',
      ],
      unavailable_false_positives: ['jordbær', 'tomater', 'agurk'],
    },
    11: {
      current: 'autumn',
      ingredients: [
        { name: 'kål',        content_hook: 'vinterkål i fuld sæson' },
        { name: 'rodfrugter', content_hook: 'rodfrugter fra haverne' },
        { name: 'vildand',    content_hook: 'vildt på kortet — and og vildsvin' },
        { name: 'vildsvin',   content_hook: 'vildtiden er i gang' },
        { name: 'æbler',      content_hook: 'lagrede æbler' },
      ],
      behavioral_signals: [
        'november er kold og mørk — indendørs kvalitet er det primære besøgsargument',
        'comfort food og varme retter driver besøg',
        'juletiden nærmer sig — december-stemning starter sidst i måneden',
      ],
      unavailable_false_positives: ['jordbær', 'tomater', 'asparges'],
    },
    12: {
      current: 'winter',
      ingredients: [
        { name: 'kål',        content_hook: 'julekål og rødkål' },
        { name: 'rodfrugter', content_hook: 'vinterrodfrugter' },
        { name: 'æbler',      content_hook: 'lagrede æbler' },
        { name: 'pærer',      content_hook: 'lagrede pærer' },
        { name: 'vildand',    content_hook: 'julemad og vildt' },
      ],
      behavioral_signals: [
        'december øger sociale sammenkomster og planlagte besøg',
        'julestemning og -mad er dominerende tema — klar sæsonankring',
        'koldt vejr driver indendørsbesøg men december-glæden øger spontanitet',
      ],
      unavailable_false_positives: ['jordbær', 'tomater', 'asparges', 'agurk'],
    },
  },
};
