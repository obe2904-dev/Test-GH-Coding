# Adding New Countries to Contextual Calendar

## Overview
The contextual calendar system is designed to be multi-country. This guide shows how to add data for new countries (Sweden, Norway, Germany, Italy, etc.).

## Database Structure

Each event has these key fields:
- `country`: ISO 3166-1 alpha-2 code (DK, SE, NO, DE, IT, etc.)
- `region`: Optional subdivision (e.g., "Skåne" for Sweden, "Bayern" for Germany)
- `event_type`: 'holiday', 'school_vacation', 'season', 'cultural', 'business_rhythm'
- `relevance_tags`: Array like `['families', 'couples', 'outdoor', 'shopping']`

## Example: Adding Sweden (SE)

### 1. Public Holidays

```sql
-- Swedish Public Holidays 2026
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('SE', 'holiday', 'Nyårsdagen', '2026-01-01', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Fresh start, new year energy', 'Promote: New year brunch, healthy menu items'),
  ('SE', 'holiday', 'Trettondagen', '2026-01-06', NULL, 'annual', ARRAY['families'], 'Emphasis: Epiphany traditions', 'Promote: Traditional Swedish fika'),
  ('SE', 'holiday', 'Långfredagen', '2026-04-03', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter traditions', 'Promote: Traditional Swedish Easter buffet'),
  ('SE', 'holiday', 'Annandag påsk', '2026-04-06', NULL, 'annual', ARRAY['families'], 'Emphasis: Easter Monday', 'Promote: Easter brunch, family dining'),
  ('SE', 'holiday', 'Första maj', '2026-05-01', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: International Workers'' Day', 'Promote: May Day celebrations, outdoor dining'),
  ('SE', 'holiday', 'Kristi himmelsfärdsdag', '2026-05-14', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Ascension Day, spring', 'Promote: Outdoor dining, spring menu'),
  ('SE', 'holiday', 'Nationaldagen', '2026-06-06', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: Swedish National Day, patriotic', 'Promote: Swedish classics, outdoor events, blue & yellow decor'),
  ('SE', 'holiday', 'Midsommarafton', '2026-06-19', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Midsummer! Biggest celebration of the year', 'Promote: Midsummer menu, sill och potatis, strawberry desserts'),
  ('SE', 'holiday', 'Midsommardagen', '2026-06-20', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Midsummer Day', 'Promote: Recovery brunch, lighter meals'),
  ('SE', 'holiday', 'Alla helgons dag', '2026-10-31', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: All Saints'' Day (Sweden celebrates seriously)', 'Promote: Quiet reflection, comfort food'),
  ('SE', 'holiday', 'Julafton', '2026-12-24', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: THE most important day - Christmas Eve', 'Watch out: Almost everything closed, family time'),
  ('SE', 'holiday', 'Juldagen', '2026-12-25', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Christmas Day', 'Promote: Christmas brunch if open'),
  ('SE', 'holiday', 'Annandag jul', '2026-12-26', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Boxing Day', 'Promote: Post-Christmas dining');
```

### 2. School Vacations

```sql
-- Swedish School Vacations 2026
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('SE', 'school_vacation', 'Sportlov (Vecka 9)', '2026-02-23', '2026-03-01', 'annual', ARRAY['families', 'outdoor'], 'Emphasis: Winter sports week, skiing', 'Promote: Après-ski menu, warm drinks, family deals'),
  ('SE', 'school_vacation', 'Påsklov', '2026-03-30', '2026-04-07', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter break', 'Promote: Easter menu, family dining'),
  ('SE', 'school_vacation', 'Sommarlov', '2026-06-12', '2026-08-17', 'annual', ARRAY['families', 'outdoor'], 'Emphasis: Long summer break, peak tourism', 'Promote: Outdoor dining, ice cream, tourist-friendly, longer hours'),
  ('SE', 'school_vacation', 'Höstlov (Vecka 44)', '2026-10-26', '2026-11-01', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Fall break, darker days', 'Promote: Cozy autumn menu, comfort food'),
  ('SE', 'school_vacation', 'Jullov', '2026-12-21', '2027-01-06', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Long Christmas break', 'Promote: Holiday specials, festive atmosphere');
```

### 3. Seasonal Context

```sql
-- Swedish Seasons (different from Denmark)
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('SE', 'season', 'Outdoor Season Begin', '2026-05-15', '2026-05-31', 'annual', ARRAY['outdoor'], 'Emphasis: Later start than DK, first warm days', 'Promote: Terrace opening, outdoor seating'),
  ('SE', 'season', 'Peak Outdoor Season', '2026-06-01', '2026-08-15', 'annual', ARRAY['outdoor'], 'Emphasis: Short but intense summer, long daylight', 'Promote: Late-night dining (midnight sun vibes), outdoor events'),
  ('SE', 'season', 'Outdoor Season End', '2026-08-16', '2026-09-15', 'annual', ARRAY['outdoor', 'cozy_indoor'], 'Emphasis: Earlier end than DK, quick transition', 'Promote: Last outdoor days, transition to cozy indoor'),
  ('SE', 'season', 'Dark Winter (Mysig tid)', '2026-10-15', '2027-03-15', 'annual', ARRAY['cozy_indoor'], 'Emphasis: Very dark, Swedish "mys" culture', 'Promote: Candlelight, warm drinks, comfort food, cozy atmosphere');
```

### 4. Cultural Events

```sql
-- Swedish Cultural Events
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('SE', 'cultural', 'Alla hjärtans dag', '2026-02-14', NULL, 'annual', ARRAY['couples', 'romantic'], 'Emphasis: Valentine''s Day', 'Promote: Romantic dinner, couples specials'),
  ('SE', 'cultural', 'Fettisdagen', '2026-02-17', NULL, 'annual', ARRAY['families'], 'Emphasis: Shrove Tuesday - SEMLOR DAY!', 'Promote: Semla (Swedish cream bun), traditional Swedish pastry'),
  ('SE', 'cultural', 'Våffeldagen', '2026-03-25', NULL, 'annual', ARRAY['families'], 'Emphasis: Waffle Day (Vårfrudagen)', 'Promote: Waffles with jam and cream, Swedish tradition'),
  ('SE', 'cultural', 'Valborg/Valborgsmässoafton', '2026-04-30', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Welcome spring! Bonfires, singing', 'Promote: Spring celebration menu, outdoor gathering'),
  ('SE', 'cultural', 'Kanelbullens dag', '2026-10-04', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Cinnamon Bun Day!', 'Promote: Cinnamon buns, Swedish fika culture'),
  ('SE', 'cultural', 'Lucia', '2026-12-13', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Saint Lucia Day, light in darkness', 'Promote: Lussekatter (saffron buns), candles, Swedish Christmas season start');
```

## Example: Adding Norway (NO)

Key differences to note:
- **17. Mai** (Constitution Day) is HUGE - more important than Christmas for outdoor celebrations
- **Skiing culture** is stronger than Denmark/Sweden
- **Outdoor season** starts even later (June) due to colder climate
- **Brown cheese and fish** traditions for cultural events

```sql
-- Norwegian Public Holiday Example
INSERT INTO contextual_calendar (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('NO', 'holiday', 'Grunnlovsdagen (17. Mai)', '2026-05-17', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Constitution Day - THE biggest celebration! Parades, ice cream, hot dogs', 'Promote: Traditional Norwegian food, outdoor seating, ice cream, hot dogs, patriotic decorations');
```

## Example: Adding Germany (DE)

Note: Germany has **regional variations** for some holidays:
- Epiphany (Jan 6) only in Bavaria, Baden-Württemberg, Saxony-Anhalt
- Corpus Christi only in some states
- Reformation Day only in some states

```sql
-- German Regional Holiday Example
INSERT INTO contextual_calendar (country, region, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DE', 'Bayern', 'holiday', 'Heilige Drei Könige', '2026-01-06', NULL, 'annual', ARRAY['families'], 'Emphasis: Epiphany (Bavaria only)', 'Promote: Traditional Bavarian menu'),
  ('DE', NULL, 'holiday', 'Tag der Deutschen Einheit', '2026-10-03', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: German Unity Day (nationwide)', 'Promote: German classics, patriotic content');
```

## Tips for Research

### Public Holidays
- Check official government websites: 
  - Denmark: https://www.borger.dk/
  - Sweden: https://www.riksdagen.se/
  - Norway: https://lovdata.no/
- Wikipedia has good overviews: "Public holidays in [Country]"

### School Vacations
- Contact ministry of education websites
- Note: Some countries have regional variations (Germany, Switzerland)

### Cultural Events
- Look for "national food days" (e.g., Cinnamon Bun Day in Sweden)
- Check retail calendars for shopping seasons
- Research local traditions (Lucia in Sweden, 17. Mai in Norway)

### Seasonal Differences
- **Outdoor season**: 
  - Southern Europe (IT, ES): March-October
  - Denmark: May-September
  - Sweden: May-August
  - Norway: June-August
- **Dark winter "cozy" season**:
  - Stronger in Nordic countries (October-March)
  - Less relevant in Southern Europe

## Testing Your Data

After adding data, test with:

```sql
-- Check all events for Sweden in June 2026
SELECT * FROM get_contextual_events('SE', '2026-06-01', '2026-06-30', NULL);

-- Check only family-relevant events
SELECT * FROM get_contextual_events('SE', '2026-06-01', '2026-06-30', ARRAY['families']);
```

## Country Priority Order (Suggested)

1. **Denmark (DK)** - ✅ DONE
2. **Sweden (SE)** - Next priority (large market, similar to DK)
3. **Norway (NO)** - Similar culture, good market
4. **Germany (DE)** - Large market, some regional complexity
5. **Netherlands (NL)** - Good hospitality market
6. **Italy (IT)** - Very different seasons, strong food culture

Would you like me to generate complete data for Sweden or Norway next?
