# English Language Leakage in Danish UI

**Application Language:** Danish  
**Scope:** Dashboard pages and related UI shells only. AI-generated content is excluded.

## Pages with English language leakage

- `/dashboard` - English-language values stored in the Danish locale bundle (`src/lib/locales/da.json`), including `Engagement Rate` and `Performance`.
- `/dashboard/profile` - English-language operations labels in the Danish locale bundle, including `Service Model`, `Budget`, and `Upscale`.
- `/dashboard/location` - English-language fallback labels hardcoded in component files, including `Neighborhood`, `Area Character`, and `Location Types`.
- `/dashboard/brand` - English-language labels hardcoded in page and modal components, including `Confidence:`, `Menu items:`, `Alternative:`, `AI Timing Intelligence`, `Drive Footfall`, `Build Brand`, and `Retain Loyalty`.
- `/dashboard/create` - English-language loader text hardcoded in components, including `Loading...` and `Loading suggestions...`.
- `/dashboard/ai-weekly-plan` - Most extensive English leakage. Includes `content plan`, `AI Generation`, `AI Captions`, `Strategic Slot`, `Drink-pairing`, `Alternative:`, `Drive Footfall`, `Build Brand`, `Retain Loyalty`, and `AI Timing Intelligence`.

## Source patterns

- Hardcoded English-language strings in React component JSX.
- English-language fallback values passed as defaults in `t(key, defaultValue)` calls.
- English-language or mixed-language entries incorrectly stored in the Danish locale bundle (`src/lib/locales/da.json`).

## Additional findings

- The application correctly defaults to Danish; this is not a global language-switching issue.
- English leakage is isolated to specific dashboard and weekly-plan UI surfaces.
- Navigation issue: the location page breadcrumb links to `/dashboard/brand-v5`, which does not match the registered route `/dashboard/brand`.