# Adding a New Country

Each supported country needs a `CountryProfile` implementation. Follow this checklist.

## Files to create

1. `<code>.ts` — e.g. `se.ts` for Sweden

## Implementation checklist

### `climate_baseline` (12 entries, months 1–12)

Source: national meteorological institute long-term climate normals (30-year average).

| Field | What to use |
|---|---|
| `avg_max_temp` | Historical average daily maximum (°C) for the reference city |
| `avg_min_temp` | Historical average daily minimum (°C) |
| `avg_rain_days` | Average number of days with precipitation per month |
| `outdoor_viable` | `true` if outdoor dining is a realistic guest expectation this month (generally May–Sep for Scandinavia, Mar–Nov for Netherlands) |
| `baseline_label` | One Danish sentence: `"[month] [country]: [X]°C maks — [one-line context]"` |

**Key principle**: `outdoor_viable: false` means "guests do not expect outdoor seating this month". Even if a specific week is warm, the *baseline* is still `false` — only the weather deviation computation changes what the AI sees.

### `season_calendar` (12 entries, months 1–12)

Source: national agricultural/horticultural seasonal calendar. Field-grown produce only (not greenhouse imports).

| Field | What to fill |
|---|---|
| `ingredients` | Local seasonal produce available from field/orchard this month. Include `content_hook` — a specific, newsworthy sentence |
| `behavioral_signals` | 2–3 abstract behavioral descriptors. **No ingredient names**. Focus on guest behaviour, daylight, occasion patterns |
| `unavailable_false_positives` | Ingredient names that *sound* seasonal but are NOT available this month locally. These are flagged in post-processing |

**Key principle for `behavioral_signals`**: These go directly into AI prompts. They must be **month-specific** — not season-level generics. "mildere temperaturer øger spontane besøg" is wrong for April DK (still 12°C). Write the actual behavioral reality.

## Register the country

In `registry.ts`:

```typescript
import { SE_COUNTRY_PROFILE } from './se.ts';

const REGISTRY: Record<string, CountryProfile> = {
  DK: DK_COUNTRY_PROFILE,
  SE: SE_COUNTRY_PROFILE,  // ← add this
};
```

## Example: Sweden (SE)

- Reference city: Stockholm (59°N) — slightly colder than Copenhagen in winter, similar in summer
- Swedish asparagus season starts ~2 weeks later than Danish (mid-May vs end of April)
- Swedish crayfish season is a unique cultural event in August (kräftskiva) — add as August `content_hook`
- Outdoor viable: May–September (same as DK, but May is borderline like DK)
