# Checklist PR: Add support for a new country (example: Sweden)

This PR contains a small, actionable checklist and code snippets to add a new country (ISO code: `SE`, language `sv`). It does not modify AI-facing files.

What this PR provides
- A clear checklist of required changes and exact code snippets to apply.
- A minimal `sv` locale skeleton you can fill with translations.
- Guidance on where to wire the country -> language mapping and which files to audit.

Files to add / edit (suggested changes, do not edit AI-facing files here):

1) Add locale file
- Create `src/lib/locales/sv.json` (skeleton below). Validate with:
  node -e "JSON.parse(require('fs').readFileSync('src/lib/locales/sv.json','utf8')); console.log('sv.json OK')"

Example skeleton (minimal):
```json
{
  "common": {
    "loading": "Läser...",
    "save": "Spara",
    "cancel": "Avbryt"
  },
  "ui": {
    "country": {
      "default_name": "Sverige",
      "SE": "Sverige"
    }
  }
}
```

2) Register or load the language in your i18n setup
- If you load locales statically, add `sv.json` to the resources used by i18n initialization.
- If you use dynamic loading, ensure the language loader can fetch `src/lib/locales/sv.json`.

3) Add country option to the selector (UI)
- Update the topbar/country selector options to include `SE` showing `t('ui.country.SE')` or `t('ui.country.default_name')` for display.

Example mapping to change app language on country selection:
```ts
// map country code -> language
const COUNTRY_TO_LANG: Record<string,string> = {
  DK: 'da',
  SE: 'sv',
  US: 'en'
}

function onCountrySelect(code: string) {
  // persist code (store/localStorage)
  setSelectedCountryCode(code)
  // change UI language
  i18n.changeLanguage(COUNTRY_TO_LANG[code] ?? 'en')
}
```

4) Save country with canonical code
- Persist `business_locations.country` as ISO code (`SE`), not localized display name.

5) Audit country-specific behaviour
- Postal code lookup: Dataforsyningen API is Denmark-only. Wrap lookups behind a country check.
  Example: `if (countryCode === 'DK') fetch('https://api.dataforsyningen.dk/...')`
- Formatting: replace `toLocaleTimeString('da-DK', ...)` with `toLocaleTimeString(i18n.language || 'en', ...)`.
- Currency/placeholders: map country -> currency and example placeholders (postal/phone formats).

6) Services
- `src/services/weatherService.ts` uses a default `countryCode: 'DK'` — ensure selected country code is passed into geocoding/weather queries.

7) Backend considerations
- Prefer storing ISO codes. If you already store display names, add a migration or accept both forms casually while migrating.

8) Tests & validation
- Add unit tests for language switch, country selector behavior, postal lookup guards, and formatting.

Next steps (suggested)
- Create a branch `feat/i18n-add-country-se` and commit the new `sv.json` and small wiring changes.
- Manually validate locales using `node -e "JSON.parse(...')"` then run `npm run dev` and spot-check.

If you want, I can:
- Create the `src/lib/locales/sv.json` file in this repo and wire the `COUNTRY_TO_LANG` mapping in the non-AI topbar file (I will not modify AI-facing code). Reply `yes, add sv.json and map SE` to proceed.
