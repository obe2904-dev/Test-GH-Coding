# Souk Aarhus Scraper Review

## Scope

This document summarizes the current behavior of the Souk Aarhus homepage analysis flow, with emphasis on the Vercel-based scraper, the edge-function scraper path, and the profile result shown in the app.

## Key Finding

The profile result shown in the app does not match the public homepage at https://soukaarhus.dk/da. The site clearly presents Souk Aarhus as a restaurant and bar with Middle Eastern cuisine, while the saved profile result classifies it as retail and uses a generic shop-style description.

That is a substantive extraction failure, not a minor wording issue.

## Evidence From The Homepage

The public homepage shows:

- Middle Eastern dining and bar positioning.
- Food and drink signals such as shawarma, mezze, cocktails, wines, and ayran.
- Booking, takeaway, catering, menu, and gift card links.
- Explicit opening hours, address, and email.
- A hospitality tone, not a retail tone.

## What The App Result Got Wrong

The result shown in the profile page currently:

- Classifies the business as retail.
- Uses a generic product / shop description.
- Leaves offerings effectively empty.
- Only partially reflects the location cue.

## Scraper Assessment

### What The Vercel Scraper Does

The Vercel scraper implementation in api/scrape.js is a Puppeteer-based serverless function that:

- Accepts POST requests with a URL.
- Requires an API key in the x-api-key header.
- Launches Chromium in Vercel.
- Waits for network idle and returns rendered HTML.
- Reports scraperType as puppeteer-vercel.

### Strengths

- It can render JavaScript-heavy pages that simple fetch cannot handle.
- It is bounded by a clear execution budget.
- It provides a simple authentication gate.
- It returns a scraper-type label that is useful for debugging.

### Concerns

- The implementation is Puppeteer, not Playwright, even though the setup doc refers to Playwright.
- The Vercel scraper does not appear to be the active production path in the edge function chain.
- The main Supabase scraper helper still routes through simple fetch and Cloud Run fallback.
- The Vercel setup documentation claims primary status that is not reflected by the runtime code I inspected.
- URL safety controls in the Vercel handler are lighter than the stricter URL validation used elsewhere in the system.
- CORS is wide open in the Vercel handler.
- Error handling is minimal and exposes raw failure details.

## Regeneration Assessment

The UI does support a real refresh action.

- The profile page passes a forceRefresh flag.
- The edge function respects that flag and bypasses the 24-hour scraped cache.
- The live page changed after Genindlæs, so the refresh path is active.

However, regeneration is only as good as the extraction pipeline behind it. In this case, the fresh result still came back semantically wrong, which suggests either:

- a poor downstream classification step,
- stale or polluted persisted data,
- or a mismatch between scraped source content and the fields used to populate the profile.

## Recommended Fixes

1. Align the runtime scraper architecture with the documented architecture. If Vercel is intended to be primary, wire it into the edge-function scraper path explicitly. If Cloud Run remains primary, update the docs to match reality.
2. Tighten URL safety in the Vercel scraper to match the stricter protection used elsewhere.
3. Reduce the mismatch between homepage evidence and saved profile fields by checking where business type and about text are derived from.
4. Preserve rich hospitality signals from the homepage, especially menu, bar, takeaway, and catering cues.
5. Treat refresh as a regeneration of the full profile, not just a cache bypass. If the underlying profile row is stale or polluted, a forced scrape alone will not fix it.
6. Separate homepage evidence from inference more clearly so the app can tell whether a field came from direct scrape, AI synthesis, or cached persistence.

## Practical Conclusion

The current setup demonstrates that the site can be re-scraped, but it also shows that the analysis result can remain badly wrong even after refresh. The main issue is not just scraping availability. The issue is correctness of the end-to-end extraction and persistence chain.

The Vercel scraper exists and is usable, but it is not clearly the active production path. The current live system behaves more like a mixed architecture with documentation drift than a clean Vercel-first scraper stack.