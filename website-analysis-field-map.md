# Website Analysis Field Map

This document maps the existing web analysis architecture, the database fields that are already available, and the main conclusions from the earlier reviews.

## Summary

The system already has the fields needed for the web analysis flow. The main work is not adding new schema, but using the right analysis path for the right kind of homepage.

There are effectively two different analysis pipelines:

1. analyze-website
2. analyze-and-distribute-website

The dashboard profile page currently uses analyze-and-distribute-website, while analyze-website is a separate standalone flow.

## End-to-end flow

### 1. Dashboard profile flow

The active profile page is the business profile page. It calls analyze-and-distribute-website.

Flow:

1. User enters a website URL in the dashboard.
2. The page calls analyze-and-distribute-website.
3. That function calls the Cloud Run scraper.
4. The scraper stores a scrape payload in the database.
5. The function calls extract-from-scrape.
6. extract-from-scrape reads the latest scrape payload and writes structured data into the business tables.

This is the live route behind the profile page.

### 2. Standalone website analysis flow

analyze-website is a separate function that:

1. Fetches the homepage directly.
2. Extracts metadata, content, opening hours, and kitchen close time.
3. Runs AI extraction.
4. Persists the result through the shared saver.

This flow has direct HTML-level extraction for opening hours and kitchen close time, so it is stronger for homepage interpretation, but it is not the dashboard route currently used for profile analysis.

## What the database already supports

The current schema already covers the main analysis outputs.

### business_locations

Used for contact and location data.

Already handled fields include:

- address_line1
- postal_code
- city
- email
- phone
- is_primary

Important note: city should be derived from postal code when possible, not left to free text.

### opening_hours

Used for weekday opening-hour rows.

Already handled fields include:

- business_id
- weekday
- open_time
- close_time
- closed
- kind

This is the correct place for structured opening-hours rows.

### business_operations

Used for operational facts.

Already handled fields include:

- establishment_type
- kitchen_close_time
- updated_at

### business_profile

Used for richer profile-level signals.

Already handled fields include:

- booking_url
- takeaway_url
- menu_structure
- menu_description
- ai_place_synopsis
- key_offerings
- menu_signal
- social_profiles

### businesses

Used for top-level business identity.

Already handled fields include:

- name
- website_url
- logo_url
- local_location_reference
- business_type_hybrid

### website_analyses / website_scrape_results

Used as storage and audit layers for raw or intermediate analysis results.

These are useful for traceability, caching, and reprocessing.

## Review conclusions

### 1. This is a classification-first problem

A homepage can be many different shapes:

- rich restaurant homepage
- menu-heavy homepage
- minimal landing page
- contact-first business page
- homepage plus important subpages

The system should classify the page shape first, then apply a tailored extraction strategy.

### 2. Web analysis should stay lightweight

Web analysis should focus on the basic business facts:

- business identity
- contact information
- opening hours
- kitchen close time when relevant
- booking and takeaway links when relevant
- a small number of representative dishes or drinks if useful

Detailed menu extraction should remain in the dedicated menu flow.

### 3. The right source depends on the business shape

Some sites expose everything on the homepage.
Some sites hide the useful content in subpages.
Some sites repeat the same information across homepage and contact page.

The extraction system should be able to look beyond the homepage when needed.

## Cafe Faust review

Cafe Faust is a good example of a rich restaurant homepage.

Observed source structure:

- homepage with clear contact and opening-hours blocks
- menu page with detailed categories and dishes
- contact page with repeated location and operational data

Best classification:

- restaurant / cafe
- homepage-rich
- menu-heavy
- contact-page-supported

Best extraction approach:

1. Read the homepage first for identity, hours, contact, booking, takeaway, and high-level positioning.
2. Use the contact page as a secondary canonical source for address and contact details.
3. Use the menu page for detailed menu extraction only.

## Recommended web-analysis scope

For web analysis only, keep the scope narrow and stable.

Recommended outputs:

- business name
- address
- postal code
- city
- phone
- email
- booking link
- takeaway link
- opening hours
- kitchen close time
- business type or classification
- up to five representative dishes or drinks if relevant

## Important architectural note

Do not use the menu extraction system as the primary web-analysis path.

Menu extraction is a separate concern and should remain separate.

Web analysis should classify the page, gather the core facts, and optionally capture a few representative menu signals only when helpful.

## Files reviewed

- src/pages/dashboard/BusinessProfilePage.tsx
- supabase/functions/analyze-website/index.ts
- supabase/functions/analyze-and-distribute-website/index.ts
- supabase/functions/extract-from-scrape/index.ts
- supabase/functions/_shared/opening-hours-extractor.ts
- supabase/functions/_shared/persistence/website-analysis-saver.ts

## Bottom line

The schema already exists.
The main task is choosing the right analysis path for the homepage shape and keeping web analysis limited to the basic fields.
Detailed menu extraction belongs elsewhere.