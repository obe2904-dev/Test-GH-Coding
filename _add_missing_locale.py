import json

with open('src/lib/locales/en.json', encoding='utf-8') as f:
    en = json.load(f)
with open('src/lib/locales/da.json', encoding='utf-8') as f:
    da = json.load(f)

# ── businessProfile additions ─────────────────────────────────────────────────

bp_en = en.setdefault('businessProfile', {})
bp_da = da.setdefault('businessProfile', {})

bp_additions_en = {
    "title": "Business Profile",
    "fullSubtitle": "Complete your business profile to get started",
    "freeSubtitleBasic": "Fill in the essentials to get started",
    "loading": "Loading...",
    "websiteUrlLabel": "Website URL",
    "websiteUrlPlaceholder": "https://www.yourbusiness.com",
    "analyzeWebsiteButton": "Analyse website",
    "analyzeWebsiteHint": "We'll extract your business details automatically",
    "analyzingWebsiteButton": "Analysing...",
    "analyzeWebsiteAriaLive": "Analysing website, please wait...",
    "analyzeButton": "Analyse",
    "analyzeHint": "Update details from website",
    "analyzingButton": "Analysing...",
    "aboutLabel": "About us",
    "aboutPlaceholder": "Write a short description of your business...",
    "aboutBusinessLabel": "About the business",
    "aboutBusinessSuffix": "",
    "aboutCharacterHint": "Describe your business character and personality",
    "aboutCharacterPlaceholder": "e.g., Cosy, local, family-friendly, casual",
    "aboutRunAnalysis": "Generate from content",
    "aboutUsUrl": "About us page URL",
    "addressLabel": "Address",
    "aiSuggestButton": "AI Suggest",
    "alertAnalysisError": "Analysis failed. Please try again.",
    "alertEnterWebsite": "Please enter a website URL first",
    "alertFetchFailed": "Could not fetch website data. Please try again.",
    "alertFieldsFetched": "Fields updated from website",
    "alertNameRequired": "Business name is required",
    "alertNotLoggedIn": "You must be logged in",
    "alertSaveFailed": "Could not save changes. Please try again.",
    "basicInfoSection": "Basic information",
    "bookingLinkLabel": "Booking link",
    "cityLabel": "City",
    "closeButton": "Close",
    "countryLabel": "Country",
    "days": {
        "man": "Mon",
        "tir": "Tue",
        "ons": "Wed",
        "tor": "Thu",
        "fre": "Fri",
        "lor": "Sat",
        "son": "Sun"
    },
    "delivery": "Delivery",
    "editButton": "Edit",
    "emailLabel": "Email",
    "generatingCharacter": "Generating business character...",
    "hoursEmpty": "No opening hours added yet",
    "hoursHasData": "Opening hours saved",
    "kidsMenu": "Kids menu",
    "logoHint": "Upload your business logo",
    "logoLabel": "Logo",
    "noChangesStatus": "No changes",
    "notFilled": "Not filled in",
    "outdoorSeating": "Outdoor seating",
    "outdoorSeatingBadge": "Outdoor",
    "parking": "Parking",
    "phoneLabel": "Phone",
    "postalCodeLabel": "Postal code",
    "powerOutlets": "Power outlets",
    "reservationRequired": "Reservation required",
    "revertButton": "Revert",
    "saveButton": "Save",
    "savedStatus": "Saved",
    "sectionAbout": "About",
    "sectionBusiness": "Business",
    "sectionContact": "Contact",
    "sectionHours": "Opening hours",
    "sectionLocation": "Location",
    "sectionService": "Services",
    "sectorPlaceholder": "Select sector...",
    "serviceNotSet": "Not set",
    "tableService": "Table service",
    "taglineAiBadge": "AI",
    "taglineHint": "A short, memorable tagline for your business",
    "taglineLabel": "Tagline",
    "taglinePlaceholder": "e.g., Where every meal is a celebration",
    "takeaway": "Takeaway",
    "typeLabel": "Business type",
    "typePlaceholder": "e.g., Restaurant, Café, Bar",
    "unsavedStatus": "Unsaved changes",
    "upgradeBannerCta": "Upgrade",
    "upgradeBannerDesc": "Unlock all features with a premium plan",
    "upgradeBannerTitle": "Unlock more",
    "websiteLabel": "Website",
    "websitePlaceholder": "https://www.yourbusiness.com",
    "wifi": "Wi-Fi",
}

bp_additions_da = {
    "title": "Virksomhedsprofil",
    "fullSubtitle": "Udfyld din virksomhedsprofil for at komme i gang",
    "freeSubtitleBasic": "Udfyld det vigtigste for at komme i gang",
    "loading": "Henter...",
    "websiteUrlLabel": "Hjemmeside URL",
    "websiteUrlPlaceholder": "https://www.dinforretning.dk",
    "analyzeWebsiteButton": "Analysér hjemmeside",
    "analyzeWebsiteHint": "Vi udtrækker automatisk forretningsoplysninger fra din hjemmeside",
    "analyzingWebsiteButton": "Analyserer...",
    "analyzeWebsiteAriaLive": "Analyserer hjemmeside, vent venligst...",
    "analyzeButton": "Analysér",
    "analyzeHint": "Opdatér detaljer fra hjemmeside",
    "analyzingButton": "Analyserer...",
    "aboutLabel": "Om os",
    "aboutPlaceholder": "Skriv en kort beskrivelse af din forretning...",
    "aboutBusinessLabel": "Om forretningen",
    "aboutBusinessSuffix": "",
    "aboutCharacterHint": "Beskriv din forretnings karakter og personlighed",
    "aboutCharacterPlaceholder": "f.eks. Hyggelig, lokal, familievenlig, afslappet",
    "aboutRunAnalysis": "Generer fra indhold",
    "aboutUsUrl": "URL til om os-side",
    "addressLabel": "Adresse",
    "aiSuggestButton": "AI Forslag",
    "alertAnalysisError": "Analyse mislykkedes. Prøv igen.",
    "alertEnterWebsite": "Indtast venligst en hjemmeside-URL først",
    "alertFetchFailed": "Kunne ikke hente hjemmesidedata. Prøv igen.",
    "alertFieldsFetched": "Felter opdateret fra hjemmeside",
    "alertNameRequired": "Forretningsnavn er påkrævet",
    "alertNotLoggedIn": "Du skal være logget ind",
    "alertSaveFailed": "Kunne ikke gemme ændringer. Prøv igen.",
    "basicInfoSection": "Basisoplysninger",
    "bookingLinkLabel": "Booking link",
    "cityLabel": "By",
    "closeButton": "Luk",
    "countryLabel": "Land",
    "days": {
        "man": "Man",
        "tir": "Tir",
        "ons": "Ons",
        "tor": "Tor",
        "fre": "Fre",
        "lor": "Lør",
        "son": "Søn"
    },
    "delivery": "Levering",
    "editButton": "Rediger",
    "emailLabel": "E-mail",
    "generatingCharacter": "Genererer forretningskarakter...",
    "hoursEmpty": "Ingen åbningstider tilføjet endnu",
    "hoursHasData": "Åbningstider gemt",
    "kidsMenu": "Børnemenu",
    "logoHint": "Upload dit virksomhedslogo",
    "logoLabel": "Logo",
    "noChangesStatus": "Ingen ændringer",
    "notFilled": "Ikke udfyldt",
    "outdoorSeating": "Udeservering",
    "outdoorSeatingBadge": "Ude",
    "parking": "Parkering",
    "phoneLabel": "Telefon",
    "postalCodeLabel": "Postnummer",
    "powerOutlets": "Stikkontakter",
    "reservationRequired": "Reservation påkrævet",
    "revertButton": "Fortryd",
    "saveButton": "Gem",
    "savedStatus": "Gemt",
    "sectionAbout": "Om os",
    "sectionBusiness": "Forretning",
    "sectionContact": "Kontakt",
    "sectionHours": "Åbningstider",
    "sectionLocation": "Placering",
    "sectionService": "Services",
    "sectorPlaceholder": "Vælg sektor...",
    "serviceNotSet": "Ikke angivet",
    "tableService": "Bordservice",
    "taglineAiBadge": "AI",
    "taglineHint": "En kort, mindeværdig tagline for din forretning",
    "taglineLabel": "Tagline",
    "taglinePlaceholder": "f.eks. Hvor hvert måltid er en fest",
    "takeaway": "Takeaway",
    "typeLabel": "Forretningstype",
    "typePlaceholder": "f.eks. Restaurant, Café, Bar",
    "unsavedStatus": "Ugemte ændringer",
    "upgradeBannerCta": "Opgrader",
    "upgradeBannerDesc": "Lås op for alle funktioner med en premium-plan",
    "upgradeBannerTitle": "Lås op for mere",
    "websiteLabel": "Hjemmeside",
    "websitePlaceholder": "https://www.dinforretning.dk",
    "wifi": "Wi-Fi",
}

# Note: days keys use non-ASCII (lør/søn) — we store under ascii keys and handle in code
# Actually the code uses days.lør and days.søn — we need those exact keys
# Override with correct subkeys
bp_additions_en["days"] = {
    "man": "Mon", "tir": "Tue", "ons": "Wed",
    "tor": "Thu", "fre": "Fri"
}
bp_additions_da["days"] = {
    "man": "Man", "tir": "Tir", "ons": "Ons",
    "tor": "Tor", "fre": "Fre"
}
# Add lør and søn separately to handle special chars
bp_additions_en["days"]["l\u00f8r"] = "Sat"
bp_additions_en["days"]["s\u00f8n"] = "Sun"
bp_additions_da["days"]["l\u00f8r"] = "L\u00f8r"
bp_additions_da["days"]["s\u00f8n"] = "S\u00f8n"

for k, v in bp_additions_en.items():
    if k not in bp_en:
        bp_en[k] = v
    elif isinstance(v, dict) and isinstance(bp_en[k], dict):
        for sk, sv in v.items():
            if sk not in bp_en[k]:
                bp_en[k][sk] = sv

for k, v in bp_additions_da.items():
    if k not in bp_da:
        bp_da[k] = v
    elif isinstance(v, dict) and isinstance(bp_da[k], dict):
        for sk, sv in v.items():
            if sk not in bp_da[k]:
                bp_da[k][sk] = sv

# ── location namespace (all new) ──────────────────────────────────────────────

en['location'] = {
    "title": "Location",
    "subtitle": "Understand your location's strengths and opportunities",
    "addressLabel": "Your address",
    "addressNote": "Fetched from your business profile.",
    "addressNoteLink": "Update address",
    "analyzeButton": "Analyse location",
    "analyzing": "Analysing...",
    "autoSaving": "Auto-saving...",
    "backToProfile": "\u2190 Back to profile",
    "continue": "Continue",
    "errorAnalyzeFailed": "Analysis failed. Please try again.",
    "errorNoAddress": "Please enter an address in your business profile first",
    "errorSaveFailed": "Could not save. Please try again.",
    "fitChallenging": "Challenging",
    "fitModerate": "Moderate fit",
    "fitStrong": "Strong fit",
    "fitUnknown": "Unknown",
    "forceReanalyze": "Re-analyse",
    "loadingAddress": "Loading address...",
    "locationScore": "Location score: {{score}}",
    "marketingStrategy": "Marketing strategy",
    "nextMenu": "Next: Menu \u2192",
    "noAddress": "No address added",
    "noAddressHint": "Add your address in the business profile to analyse your location",
    "reanalyze": "Re-analyse",
    "reanalyzeWithAge": "Re-analyse ({{count}} days old)",
    "cacheValid": "Analysis from {{count}} days ago",
    "strategyFocus": "Strategy focus",
    "strengths": "Strengths",
    "addAddressLink": "Add address \u2192",
    "breadcrumb": {
        "profile": "Profile",
        "menu": "Menu",
        "location": "Location",
        "brand": "Brand Profile"
    }
}

da['location'] = {
    "title": "Lokation",
    "subtitle": "Forst\u00e5 din lokations styrker og muligheder",
    "addressLabel": "Din adresse",
    "addressNote": "Hentet fra din virksomhedsprofil.",
    "addressNoteLink": "Opdatér adresse",
    "analyzeButton": "Analysér lokation",
    "analyzing": "Analyserer...",
    "autoSaving": "Gemmer automatisk...",
    "backToProfile": "\u2190 Tilbage til profil",
    "continue": "Fortsæt",
    "errorAnalyzeFailed": "Analyse mislykkedes. Prøv igen.",
    "errorNoAddress": "Tilføj venligst en adresse i din virksomhedsprofil først",
    "errorSaveFailed": "Kunne ikke gemme. Prøv igen.",
    "fitChallenging": "Udfordrende",
    "fitModerate": "Moderat match",
    "fitStrong": "Godt match",
    "fitUnknown": "Ukendt",
    "forceReanalyze": "Re-analysér",
    "loadingAddress": "Henter adresse...",
    "locationScore": "Lokationsscore: {{score}}",
    "marketingStrategy": "Marketingstrategi",
    "nextMenu": "N\u00e6ste: Menu \u2192",
    "noAddress": "Ingen adresse tilf\u00f8jet",
    "noAddressHint": "Tilf\u00f8j din adresse i virksomhedsprofilen for at analysere din placering",
    "reanalyze": "Re-analysér",
    "reanalyzeWithAge": "Re-analysér ({{count}} dage gammel)",
    "cacheValid": "Analyse fra {{count}} dage siden",
    "strategyFocus": "Strategifokus",
    "strengths": "Styrker",
    "addAddressLink": "Tilf\u00f8j adresse \u2192",
    "breadcrumb": {
        "profile": "Virksomhedsprofil",
        "menu": "Det vi tilbyder",
        "location": "Lokation",
        "brand": "Brand Profil"
    }
}

# ── navigation additions ──────────────────────────────────────────────────────

nav_en = en.setdefault('navigation', {})
nav_da = da.setdefault('navigation', {})

if 'yourBusiness' not in nav_en:
    nav_en['yourBusiness'] = "1. Your business"
if 'whatWeOffer' not in nav_en:
    nav_en['whatWeOffer'] = "What we offer"
if 'yourBusiness' not in nav_da:
    nav_da['yourBusiness'] = "1. Virksomhedsprofil"
if 'whatWeOffer' not in nav_da:
    nav_da['whatWeOffer'] = "Det vi tilbyder"

# ── menu additions ────────────────────────────────────────────────────────────

menu_en = en.setdefault('menu', {})
menu_da = da.setdefault('menu', {})

menu_additions_en = {
    "addManualText": "Add menu as text",
    "findOn": "Find menu on",
    "noLinksFound": "No menu links found on the website",
    "extractFailed": "Menu extraction failed. Please try again.",
    "savePricingFailed": "Could not save pricing. Please try again.",
    "header": {
        "title": "What we offer",
        "subtitle": "Add your menu so we can create relevant content",
        "subtitle2": "Your menu and offerings"
    },
    "free": {
        "upgradeTitle": "Unlock menu features",
        "cta": "Upgrade to add menu"
    },
    "batch": {
        "extracting": "Extracting...",
        "inQueue": "in queue",
        "helper": "We'll extract menu items automatically from each source"
    },
    "detect": {
        "find": "Find menu pages",
        "searching": "Searching..."
    },
    "error": {
        "noWebsite": "Please add a website URL to your business profile first",
        "analyzeFailed": "Could not analyse the website. Please try again.",
        "noMenusFound": "No menu pages found on the website",
        "addFailed": "Could not add menu source. Please try again.",
        "linkAlreadyAdded": "This link has already been added",
        "saveEdit": "Could not save edit. Please try again.",
        "analyzeMenuFailed": "Could not analyse menu text. Please try again."
    },
    "delete": {
        "confirm": "Are you sure you want to delete this menu?",
        "inProgress": "Deleting menu..."
    },
    "sources": {
        "heading": "{{count}} menu page found",
        "heading_plural": "{{count}} menu pages found",
        "subheading": "Select the pages you want to import",
        "selectAll": "Select all",
        "deselectAll": "Deselect all",
        "howItWorks": "How it works",
        "fetchSelected": "Import {{count}} selected",
        "processing": "Processing {{count}}...",
        "processingHint": "This may take a moment",
        "fromLabel": "From: {{label}}",
        "itemCount": "{{count}} items",
        "avgPrice": "avg. {{price}} kr.",
        "statusPending": "Pending",
        "statusExtracting": "Extracting...",
        "statusError": "Error",
        "defaultTitle": "Menu page",
        "pendingHint": "Waiting to be processed",
        "collapse": "Collapse",
        "expand": "Show items",
        "tooltipCannotDelete": "Cannot delete — currently extracting",
        "tooltipDeleteSource": "Delete source",
        "tooltipRemoveFromList": "Remove from list",
        "emptyCategory": "No items in this category",
        "emptyTitle": "No menu items found",
        "emptySubtitle": "Try adding menu items manually",
        "emptyState": "No menu links added yet",
        "emptyStateHint": "Detect menu pages from your website or add a link manually",
        "emptyState2": "No menu text added yet",
        "emptyState2Hint": "Paste your menu as text to extract items automatically"
    },
    "pricing": {
        "heading": "Pricing",
        "edit": "Edit pricing",
        "save": "Save",
        "saving": "Saving...",
        "cancel": "Cancel",
        "levelFieldLabel": "Price level",
        "levelPlaceholder": "Select price level...",
        "levelLabel": "Price level: {{level}}",
        "budget": "Budget",
        "moderate": "Moderate",
        "upscale": "Upscale",
        "fineDining": "Fine dining",
        "avgCheckLabel": "Average spend per person",
        "avgLabel": "avg. {{avg}} kr.",
        "notSet": "Pricing not set"
    }
}

menu_additions_da = {
    "addManualText": "Tilf\u00f8j menu som tekst",
    "findOn": "Find menu p\u00e5",
    "noLinksFound": "Ingen menusider fundet p\u00e5 hjemmesiden",
    "extractFailed": "Menuudtr\u00e6k mislykkedes. Pr\u00f8v igen.",
    "savePricingFailed": "Kunne ikke gemme priser. Pr\u00f8v igen.",
    "header": {
        "title": "Det vi tilbyder",
        "subtitle": "Tilf\u00f8j din menu, s\u00e5 vi kan lave relevant indhold",
        "subtitle2": "Din menu og dine tilbud"
    },
    "free": {
        "upgradeTitle": "L\u00e5s op for menufunktioner",
        "cta": "Opgrader for at tilf\u00f8je menu"
    },
    "batch": {
        "extracting": "Udtr\u00e6kker...",
        "inQueue": "i k\u00f8",
        "helper": "Vi udtr\u00e6kker automatisk menupunkter fra hver kilde"
    },
    "detect": {
        "find": "Find menusider",
        "searching": "S\u00f8ger..."
    },
    "error": {
        "noWebsite": "Tilf\u00f8j venligst en hjemmeside-URL til din virksomhedsprofil f\u00f8rst",
        "analyzeFailed": "Kunne ikke analysere hjemmesiden. Pr\u00f8v igen.",
        "noMenusFound": "Ingen menusider fundet p\u00e5 hjemmesiden",
        "addFailed": "Kunne ikke tilf\u00f8je menukilde. Pr\u00f8v igen.",
        "linkAlreadyAdded": "Dette link er allerede tilf\u00f8jet",
        "saveEdit": "Kunne ikke gemme redigering. Pr\u00f8v igen.",
        "analyzeMenuFailed": "Kunne ikke analysere menutekst. Pr\u00f8v igen."
    },
    "delete": {
        "confirm": "Er du sikker p\u00e5, at du vil slette denne menu?",
        "inProgress": "Sletter menu..."
    },
    "sources": {
        "heading": "{{count}} menusider fundet",
        "subheading": "V\u00e6lg de sider du vil importere",
        "selectAll": "V\u00e6lg alle",
        "deselectAll": "Frav\u00e6lg alle",
        "howItWorks": "S\u00e5dan fungerer det",
        "fetchSelected": "Importer {{count}} valgte",
        "processing": "Behandler {{count}}...",
        "processingHint": "Dette kan tage et \u00f8jeblik",
        "fromLabel": "Fra: {{label}}",
        "itemCount": "{{count}} menupunkter",
        "avgPrice": "gns. {{price}} kr.",
        "statusPending": "Afventer",
        "statusExtracting": "Udtr\u00e6kker...",
        "statusError": "Fejl",
        "defaultTitle": "Menusiden",
        "pendingHint": "Venter p\u00e5 at blive behandlet",
        "collapse": "Skjul",
        "expand": "Vis menupunkter",
        "tooltipCannotDelete": "Kan ikke slette \u2014 udtr\u00e6kker i \u00f8jeblikket",
        "tooltipDeleteSource": "Slet kilde",
        "tooltipRemoveFromList": "Fjern fra liste",
        "emptyCategory": "Ingen menupunkter i denne kategori",
        "emptyTitle": "Ingen menupunkter fundet",
        "emptySubtitle": "Pr\u00f8v at tilf\u00f8je menupunkter manuelt",
        "emptyState": "Ingen menulinks tilf\u00f8jet endnu",
        "emptyStateHint": "Find menusider fra din hjemmeside eller tilf\u00f8j et link manuelt",
        "emptyState2": "Ingen menutekst tilf\u00f8jet endnu",
        "emptyState2Hint": "Ind\u00e6t din menu som tekst for at udtr\u00e6kke menupunkter automatisk"
    },
    "pricing": {
        "heading": "Priser",
        "edit": "Rediger priser",
        "save": "Gem",
        "saving": "Gemmer...",
        "cancel": "Annuller",
        "levelFieldLabel": "Prisniveau",
        "levelPlaceholder": "V\u00e6lg prisniveau...",
        "levelLabel": "Prisniveau: {{level}}",
        "budget": "Budgetvenlig",
        "moderate": "Moderat",
        "upscale": "H\u00f8jt niveau",
        "fineDining": "Finere restauration",
        "avgCheckLabel": "Gennemsnitlig pris per kuvert",
        "avgLabel": "gns. {{avg}} kr.",
        "notSet": "Priser ikke angivet"
    }
}

def deep_merge_add(target, additions):
    for k, v in additions.items():
        if k not in target:
            target[k] = v
        elif isinstance(v, dict) and isinstance(target[k], dict):
            deep_merge_add(target[k], v)

deep_merge_add(menu_en, menu_additions_en)
deep_merge_add(menu_da, menu_additions_da)

# Write out
with open('src/lib/locales/en.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, indent=2, ensure_ascii=False)
    f.write('\n')
with open('src/lib/locales/da.json', 'w', encoding='utf-8') as f:
    json.dump(da, f, indent=2, ensure_ascii=False)
    f.write('\n')

print("Done")
print("en.location keys:", list(en.get('location', {}).keys()))
print("en.businessProfile.title:", en.get('businessProfile', {}).get('title'))
print("en.menu.header.title:", en.get('menu', {}).get('header', {}).get('title'))
print("en.navigation.yourBusiness:", en.get('navigation', {}).get('yourBusiness'))
