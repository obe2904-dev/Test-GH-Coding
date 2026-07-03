-- =====================================================
-- MIGRATION: Translate calendar content_angle and marketing_hook to Danish
-- =====================================================
-- Problem: English text in calendar events gets inserted into Danish prompts,
-- causing AI to translate awkwardly (e.g., "terrace atmosphere" → "terrassen")
-- Solution: Translate all content_angle and marketing_hook fields to Danish

-- ── HOLIDAYS ──────────────────────────────────────────────────────────────

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Frisk start, nytårsstemning',
  marketing_hook = 'Fremhæv: Nytårsbrunch, sunde menupunkter'
WHERE country = 'DK' AND event_name = 'Nytårsdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Lang weekend begynder',
  marketing_hook = 'Fremhæv: Påskemenu, familiemiddag'
WHERE country = 'DK' AND event_name = 'Skærtorsdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Påsketraditioner',
  marketing_hook = 'Fremhæv: Traditionel dansk påskefrokost'
WHERE country = 'DK' AND event_name = 'Langfredag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: 1. Påskedag, hovedfejring',
  marketing_hook = 'Fremhæv: Påskesøndag brunch, special påskemenu, familiemiddag'
WHERE country = 'DK' AND event_name = '1. Påskedag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Familiesammenkomster',
  marketing_hook = 'Fremhæv: Påskebrunch, familievenlig atmosfære'
WHERE country = 'DK' AND event_name = '2. Påskedag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Ofte kombineret med weekend fri',
  marketing_hook = 'Fremhæv: Udendørs servering, dagsture'
WHERE country = 'DK' AND event_name = 'Kristi Himmelfartsdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Pinseweekend',
  marketing_hook = 'Fremhæv: Forårsmenu, udendørs spisning'
WHERE country = 'DK' AND event_name = '2. Pinsedag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Grundlovsdag, patriotisk',
  marketing_hook = 'Fremhæv: Danske klassikere, udendørs arrangementer'
WHERE country = 'DK' AND event_name = 'Grundlovsdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: De fleste steder lukket, familietid',
  marketing_hook = 'Bemærk: Respektér at de fleste er hjemme'
WHERE country = 'DK' AND event_name = 'Juleaftensdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Juledag',
  marketing_hook = 'Fremhæv: Julebrunch hvis åbent'
WHERE country = 'DK' AND event_name = '1. Juledag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: 2. Juledag, familiesammenkomster',
  marketing_hook = 'Fremhæv: Afslappet spisning efter jul'
WHERE country = 'DK' AND event_name = '2. Juledag';

-- ── SCHOOL VACATIONS ──────────────────────────────────────────────────────

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Familieaktiviteter, børn hjemme',
  marketing_hook = 'Fremhæv: Børnemenu, familievenlig frokost, varm kakao'
WHERE country = 'DK' AND event_name = 'Vinterferie';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Påskeferie, familietid',
  marketing_hook = 'Fremhæv: Påskebrunch, familiemiddag, børneaktiviteter'
WHERE country = 'DK' AND event_name = 'Påskeferie';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Højsæson for ferier, turisme',
  marketing_hook = 'Fremhæv: Udendørs servering, is, forfriskende drinks, turist-venligt'
WHERE country = 'DK' AND event_name = 'Sommerferie';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Efterårsferie, hyggelige indendørsaktiviteter',
  marketing_hook = 'Fremhæv: Varm comfort food, efterårsmenu, familietilbud'
WHERE country = 'DK' AND event_name = 'Efterårsferie (Uge 42)';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Juleferie, julesæson',
  marketing_hook = 'Fremhæv: Juletilbud, festlig atmosfære, gavekort'
WHERE country = 'DK' AND event_name = 'Juleferie';

-- ── SEASONAL PERIODS ──────────────────────────────────────────────────────

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Første varme dage, udeentusiasme',
  marketing_hook = 'Fremhæv: Åbning af udendørs servering, udelivsstil'
WHERE country = 'DK' AND event_name = 'Outdoor Season Begin';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Sommerspisning, lange aftener',
  marketing_hook = 'Fremhæv: Udendørs arrangementer, kolde drinks, aftenmad'
WHERE country = 'DK' AND event_name = 'Peak Outdoor Season';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Sidste varme dage, overgang til indendørs',
  marketing_hook = 'Fremhæv: Sensommer udendørs, hyggelig indendørs atmosfære'
WHERE country = 'DK' AND event_name = 'Outdoor Season End';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Juleshopping, gavekøb, stressede shoppere',
  marketing_hook = 'Fremhæv: Hurtig frokost, take-away kaffe, gavekort, afslapningspause'
WHERE country = 'DK' AND event_name = 'Shopping Season (Pre-Christmas)';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Mørke aftener, hyggekultur, komfort',
  marketing_hook = 'Fremhæv: Hyggelig atmosfære, stearinlys, varme drinks, comfort food'
WHERE country = 'DK' AND event_name = 'Dark Winter (Hygge)';

-- ── CULTURAL EVENTS ───────────────────────────────────────────────────────

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Romantisk spisning, par-orienteret',
  marketing_hook = 'Fremhæv: Romantisk aftensmenu, par-tilbud, intim atmosfære'
WHERE country = 'DK' AND event_name = 'Valentinsdag';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Dansk fastelavnstradition, børn',
  marketing_hook = 'Fremhæv: Fastelavnsboller, familievenligt, kostumestemning'
WHERE country = 'DK' AND event_name = 'Fastelavn';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Midsommerfeiring, bål',
  marketing_hook = 'Fremhæv: Sommeraftensmad, udendørs atmosfære, danske traditioner'
WHERE country = 'DK' AND event_name = 'Sankt Hans Aften';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Shopping-vanvid, tilbud',
  marketing_hook = 'Fremhæv: Særtilbud, kaffepause til trætte shoppere, hurtige måltider'
WHERE country = 'DK' AND event_name = 'Black Friday';

-- ── BUSINESS RHYTHMS ──────────────────────────────────────────────────────

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Afslappet tempo, fritid, brunchkultur',
  marketing_hook = 'Fremhæv: Brunchmenu, længere spisetid, familiesammenkomster'
WHERE country = 'DK' AND event_name = 'Weekend';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Slutningen på ugen, efter-arbejde drinks',
  marketing_hook = 'Fremhæv: Happy hour, barmenu, social atmosfære'
WHERE country = 'DK' AND event_name = 'Fredag Bar';

UPDATE contextual_calendar
SET 
  content_angle = 'Vægt på: Tilbage på arbejde, behov for komfort',
  marketing_hook = 'Fremhæv: Comfort food, hurtig frokost, energigivende kaffe'
WHERE country = 'DK' AND event_name = 'Mandag Blues';
