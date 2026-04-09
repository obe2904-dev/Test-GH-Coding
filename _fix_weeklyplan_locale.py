#!/usr/bin/env python3
"""Add weeklyPlan i18n keys for the ai-weekly-plan page, WeeklyPlanOverview, and PostDetailModal."""
import json, sys

EN_PATH = "src/lib/locales/en.json"
DA_PATH = "src/lib/locales/da.json"

EN_KEYS = {
  "loading": "Loading weekly plan...",
  "progress": {
    "stage1Title": "Weekly plan",
    "stage1Sub": "Select post",
    "stage2Title": "Design",
    "imageReady": "Image ready",
    "pending": "Pending",
    "stage3Title": "Publish"
  },
  "weekToggle": {
    "current": "This week",
    "next": "Next week"
  },
  "empty": {
    "welcomeBack": "Welcome back!",
    "noPlanCurrent": "No plan for this week",
    "noPlanYet": "No weekly plan yet",
    "descExisting": "You have a saved plan for this week. Choose to load it or generate a new one.",
    "descCurrentWeek": "No plan generated for the current week — you can still generate a plan and start creating posts.",
    "descNextWeek": "Let the AI generate a tailored content plan for next week — built on your business profile, venue type, location and current conditions.",
    "loadExisting": "Load Existing Plan",
    "generateNew": "Generate New Plan",
    "generateWeekly": "Generate Weekly Plan"
  },
  "generating": {
    "title": "🎨 AI is working on your weekly plan...",
    "subtitle": "This typically takes 2–3 minutes. The AI creates natural, authentic captions for each post.",
    "step1Title": "Analysing your brand and menu",
    "step1Desc": "Brand voice, values, season and menu items",
    "step2Title": "Finding the best content opportunities",
    "step2Desc": "Based on season, weather and performance",
    "step3Title": "Generating AI captions with Gemini 2.5 Flash",
    "step3Desc": "Authentic, brand-consistent, natural tone",
    "step4Title": "Assembling the final weekly plan",
    "step4Desc": "Visual direction, timing, platform optimisation",
    "footer": "The AI is running a full strategic pipeline. The page will update automatically when your plan is ready."
  },
  "context": {
    "label": "Week context",
    "outdoorOpportunity": "☀️ Outdoor opportunity",
    "indoorFocus": "🌧 Indoor focus",
    "payPeriod": "💰 Pay period"
  },
  "regenModal": {
    "title": "Replace existing plan?",
    "desc": "This will replace your current weekly plan. All changes will be lost. Are you sure you want to continue?",
    "cancel": "Cancel",
    "confirm": "Generate New Plan"
  },
  "errors": {
    "noExistingPlan": "Could not find existing plan",
    "loadFailed": "Could not load plan",
    "saveFailed": "Could not save changes",
    "strategyFailed": "Could not generate strategic context. Go to \"Weekly Strategy\" and try from there."
  },
  "archetype": {
    "morning_cafe": "Morning café",
    "brunch_cafe": "Brunch café",
    "all_day_cafe": "All-day café",
    "lunch_restaurant": "Lunch restaurant",
    "dinner_restaurant": "Dinner restaurant",
    "full_service_restaurant": "Full-service",
    "evening_bar": "Evening bar",
    "late_night_bar": "Late-night bar",
    "wine_bar": "Wine bar",
    "fast_casual": "Fast casual"
  },
  "weather": {
    "staleAlert": "The weather forecast is now more accurate than when the plan was generated — update the weather for the latest estimates for the weekend.",
    "headerCurrent": "Weather forecast this week",
    "headerNext": "Weather forecast next week",
    "headerWeek": "Weather forecast week {{n}}",
    "updating": "Updating...",
    "updateBtn": "↻ Update weather",
    "noChange": "Weather hasn't changed significantly — no reason to generate a new plan.",
    "changedNoImpact": "Weather has changed, but no posts in the plan appear to be affected.",
    "changedImpact_one": "Weather has changed significantly — 1 post may be affected: {{posts}}",
    "changedImpact_other": "Weather has changed significantly — {{count}} posts may be affected: {{posts}}",
    "considerNew": "Consider generating a new plan so the suggestions account for the updated weather.",
    "generateNewBtn": "↺ Generate new plan",
    "condSunny": "sunny",
    "condPartlyCloudy": "partly cloudy",
    "condCloudy": "overcast",
    "condRain": "rainy",
    "condSnow": "snowy",
    "condFog": "foggy",
    "dayMonday": "Monday",
    "dayTuesday": "Tuesday",
    "dayWednesday": "Wednesday",
    "dayThursday": "Thursday",
    "dayFriday": "Friday",
    "daySaturday": "Saturday",
    "daySunday": "Sunday",
    "heavyRainWeek": "Heavy rain week — {{rainDays}} out of {{totalDays}} days with rain",
    "winterWeek": "Winter-like week with snow on {{snowDays}} days",
    "mixedWeek": "Mixed week — {{sunnyDays}} ⛅ days and {{rainDays}} rainy days",
    "overallWeek": "Predominantly {{emoji}} {{condition}} week",
    "tempRange": ". Temperatures from {{min}}° to {{max}}° (average max {{avg}}°C).",
    "warmest": "Warmest {{day}} ({{temp}}°)",
    "coldest": "coldest {{day}} ({{temp}}°)",
    "mostRain": "most rain {{day}} ({{pct}}% chance)",
    "weekendSummary": "Weekend: {{conditions}} — approx. {{avg}}°C.",
    "weekendGood": " Good for outdoor traffic.",
    "weekendRain": " Rain at the weekend increases spontaneous indoor visits — use it for atmosphere or experience posts.",
    "weekendAllRain": "🌧️ rainy"
  },
  "overview": {
    "weekPrefix": "Week",
    "generateNew": "Generate new plan",
    "noPostsPlanned": "No posts planned",
    "doneBadge": "✓ Done",
    "pastBadge": "⏰ Past",
    "createPost": "Create post →",
    "tip": "💡 Tip: Click a post to see the full specification, edit the caption, upload photo/video and approve for publishing.",
    "focusLabel": "Focus:",
    "months": {
      "january": "January", "february": "February", "march": "March",
      "april": "April", "may": "May", "june": "June",
      "july": "July", "august": "August", "september": "September",
      "october": "October", "november": "November", "december": "December"
    },
    "days": {
      "short": {
        "Mon": "Mon", "Tue": "Tue", "Wed": "Wed", "Thu": "Thu",
        "Fri": "Fri", "Sat": "Sat", "Sun": "Sun"
      },
      "shortFromIndex": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      "longFromIndex": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    },
    "dayLabels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "timing": {
      "morning": "Morning window",
      "lunch": "Lunch decision",
      "dinner": "Dinner planning",
      "eveningFomo": "Evening FOMO",
      "eveningEngagement": "Evening engagement",
      "peak": "Peak engagement",
      "weekend": "Weekend engagement",
      "optimal": "Optimal timing"
    },
    "cta": {
      "booking": "🔔 Book a table",
      "event": "🎉 Event",
      "engagement": "💬 Engagement",
      "awareness": "👁️ Share",
      "traffic": "⚡ Drive traffic",
      "default": "✨ Visit us"
    },
    "status": {
      "draft": "Draft",
      "approved": "Approved",
      "scheduled": "Scheduled",
      "posted": "Posted"
    }
  },
  "detail": {
    "title": "Post Specification",
    "timeAt": "at",
    "pastTitle": "Post scheduled in the past",
    "pastDesc": "This post is scheduled for {{date}} at {{time}}, which has passed. You can reschedule the post to a new date below.",
    "reschedule": "📅 Move to next week (+7 days)",
    "whyPost": "💡 Why this post?",
    "timingSection": "📅 Timing",
    "day": "Day",
    "date": "Date",
    "time": "Time",
    "rationale": "Rationale",
    "platform": "📱 Platform & Format",
    "platformLabel": "Platform",
    "format": "Format",
    "platformRationale": "Platform Rationale",
    "formatRationale": "Format Rationale",
    "postType": "📝 Post Type",
    "type": "Type",
    "category": "Category",
    "priority": "Priority",
    "reasons": "Reasons",
    "content": "🎯 Content",
    "whyThisDish": "Why this item:",
    "caption": "💬 Caption",
    "aiGenerated": "AI Generated",
    "generatingCaption": "Generating...",
    "regenerate": "Regenerate",
    "regenerateTitle": "Generate new caption with AI",
    "editCaption": "Edit",
    "characters": "{{count}} characters",
    "cancelEdit": "Cancel",
    "save": "Save",
    "hashtags": "Hashtags:",
    "quality": "Quality:",
    "visualDirection": "📸 Visual Direction",
    "subject": "Subject",
    "angle": "Angle",
    "setting": "Setting",
    "lighting": "Lighting",
    "styling": "Styling",
    "context": "Context",
    "technicalSpecs": "Technical specs",
    "fileFormat": "Format:",
    "dimensions": "Size:",
    "aspectRatio": "Ratio:",
    "media": "📦 Media",
    "uploading": "Uploading...",
    "uploadMedia": "Upload photo/video",
    "dragDrop": "or drag and drop here",
    "replaceImage": "Replace image",
    "exportBrief": "Export Photographer Brief (PDF)",
    "productionNotes": "⏱️ Production Notes",
    "estimatedTime": "Estimated time",
    "logistics": "Logistics",
    "alternatives": "🔄 Alternatives",
    "altPrefix": "Alt {{n}}:",
    "statusLabel": "Status:",
    "statusDraft": "Draft",
    "statusApproved": "Approved",
    "statusScheduled": "Scheduled",
    "statusPosted": "Posted",
    "close": "Close",
    "approve": "Approve Post",
    "uploadError": "Could not upload file. Please try again."
  }
}

DA_KEYS = {
  "loading": "Indlæser ugentlig plan...",
  "progress": {
    "stage1Title": "Ugentlig plan",
    "stage1Sub": "Vælg opslag",
    "stage2Title": "Design",
    "imageReady": "Billede klar",
    "pending": "Afventer",
    "stage3Title": "Publish"
  },
  "weekToggle": {
    "current": "Denne uge",
    "next": "Næste uge"
  },
  "empty": {
    "welcomeBack": "Velkommen tilbage!",
    "noPlanCurrent": "Ingen plan for denne uge",
    "noPlanYet": "Ingen ugentlig plan endnu",
    "descExisting": "Du har en gemt plan for denne uge. Vælg om du vil indlæse den eller generere en ny.",
    "descCurrentWeek": "Ingen plan genereret for indeværende uge — du kan stadig generere en plan og komme i gang med opslag.",
    "descNextWeek": "Lad AI'en generere en skræddersyet indholdsplan til næste uge — bygget på din virksomhedsprofil, din type af sted, lokation og ugens aktuelle forhold.",
    "loadExisting": "Indlæs Eksisterende Plan",
    "generateNew": "Generer Ny Plan",
    "generateWeekly": "Generer Ugentlig Plan"
  },
  "generating": {
    "title": "🎨 AI'en arbejder på din ugentlige plan...",
    "subtitle": "Dette tager typisk 2–3 minutter. AI'en laver naturlige, autentiske danske captions til hvert opslag.",
    "step1Title": "Analyserer dit brand og menukort",
    "step1Desc": "Brand voice, værdier, sæson og menu items",
    "step2Title": "Finder de bedste content opportunities",
    "step2Desc": "Baseret på sæson, vejr og performance",
    "step3Title": "Genererer AI captions med Gemini 2.5 Flash",
    "step3Desc": "Autentisk dansk, brand-konsistent, naturlig tone",
    "step4Title": "Samler alt til færdig ugentlig plan",
    "step4Desc": "Visuel direction, timing, platform optimization",
    "footer": "AI'en kører et fuldt strategisk pipeline. Siden opdaterer automatisk når din plan er klar."
  },
  "context": {
    "label": "Ugens kontekst",
    "outdoorOpportunity": "☀️ Udendørs mulighed",
    "indoorFocus": "🌧 Indendørs fokus",
    "payPeriod": "💰 Lønningsperiode"
  },
  "regenModal": {
    "title": "Erstat eksisterende plan?",
    "desc": "Dette vil erstatte din nuværende ugentlige plan. Alle ændringer vil gå tabt. Er du sikker på, at du vil fortsætte?",
    "cancel": "Annuller",
    "confirm": "Generer Ny Plan"
  },
  "errors": {
    "noExistingPlan": "Kunne ikke finde eksisterende plan",
    "loadFailed": "Kunne ikke indlæse plan",
    "saveFailed": "Kunne ikke gemme ændringer",
    "strategyFailed": "Det lykkedes ikke at generere den strategiske kontekst. Gå til \"Ugensplan\" og prøv derfra."
  },
  "archetype": {
    "morning_cafe": "Morgen-café",
    "brunch_cafe": "Brunch-café",
    "all_day_cafe": "All-day café",
    "lunch_restaurant": "Frokostrestaurant",
    "dinner_restaurant": "Aftenrestaurant",
    "full_service_restaurant": "Full-service",
    "evening_bar": "Aftenbar",
    "late_night_bar": "Nattelivsbar",
    "wine_bar": "Vinbar",
    "fast_casual": "Fast casual"
  },
  "weather": {
    "staleAlert": "Vejrudsigten er nu mere præcis end da planen blev genereret — opdater vejret for de nyeste estimater til weekenden.",
    "headerCurrent": "Vejrudsigt denne uge",
    "headerNext": "Vejrudsigt næste uge",
    "headerWeek": "Vejrudsigt uge {{n}}",
    "updating": "Opdaterer...",
    "updateBtn": "↻ Opdater vejr",
    "noChange": "Vejret er ikke ændret væsentligt — ingen grund til at generere en ny plan.",
    "changedNoImpact": "Vejret har ændret sig, men ingen opslag i planen ser ud til at blive påvirket.",
    "changedImpact_one": "Vejret har ændret sig markant — ét opslag kan være påvirket: {{posts}}",
    "changedImpact_other": "Vejret har ændret sig markant — {{count}} opslag kan være påvirket: {{posts}}",
    "considerNew": "Overvej at generere en ny plan, så forslagene tager højde for det opdaterede vejr.",
    "generateNewBtn": "↺ Generer ny plan",
    "condSunny": "solrig",
    "condPartlyCloudy": "delvist skyet",
    "condCloudy": "overskyet",
    "condRain": "regnfuld",
    "condSnow": "snefuld",
    "condFog": "tåget",
    "dayMonday": "mandag",
    "dayTuesday": "tirsdag",
    "dayWednesday": "onsdag",
    "dayThursday": "torsdag",
    "dayFriday": "fredag",
    "daySaturday": "lørdag",
    "daySunday": "søndag",
    "heavyRainWeek": "Udpræget regnvejrsuge — {{rainDays}} ud af {{totalDays}} dage med regn",
    "winterWeek": "Vinterpræget uge med sne på {{snowDays}} dage",
    "mixedWeek": "Blandet uge — {{sunnyDays}} ⛅ dage og {{rainDays}} regndage",
    "overallWeek": "Overvejende {{emoji}} {{condition}} uge",
    "tempRange": ". Temperaturer fra {{min}}° til {{max}}° (snit maks {{avg}}°C).",
    "warmest": "Varmest {{day}} ({{temp}}°)",
    "coldest": "køligst {{day}} ({{temp}}°)",
    "mostRain": "mest regn {{day}} ({{pct}}% chance)",
    "weekendSummary": "Weekend: {{conditions}} — ca. {{avg}}°C.",
    "weekendGood": " Godt for udetrafik.",
    "weekendRain": " Regnvejr i weekenden øger spontane indendørs-besøg — brug det til atmosfære- eller oplevelses-posts.",
    "weekendAllRain": "🌧️ regnfuldt"
  },
  "overview": {
    "weekPrefix": "Uge",
    "generateNew": "Generer ny plan",
    "noPostsPlanned": "Ingen opslag planlagt",
    "doneBadge": "✓ Lavet",
    "pastBadge": "⏰ Fortid",
    "createPost": "Lav opslag →",
    "tip": "💡 Tip: Klik på et opslag for at se fuld specifikation, redigere caption, uploade foto/video og godkende til publicering.",
    "focusLabel": "Fokus:",
    "months": {
      "january": "januar", "february": "februar", "march": "marts",
      "april": "april", "may": "maj", "june": "juni",
      "july": "juli", "august": "august", "september": "september",
      "october": "oktober", "november": "november", "december": "december"
    },
    "days": {
      "short": {
        "Mon": "Man", "Tue": "Tir", "Wed": "Ons", "Thu": "Tor",
        "Fri": "Fre", "Sat": "Lør", "Sun": "Søn"
      },
      "shortFromIndex": ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"],
      "longFromIndex": ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"]
    },
    "dayLabels": ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"],
    "timing": {
      "morning": "Morgen-vindue",
      "lunch": "Frokost-beslutning",
      "dinner": "Aftenmad-planlægning",
      "eveningFomo": "Aften-FOMO",
      "eveningEngagement": "Aften-engagement",
      "peak": "Peak engagement",
      "weekend": "Weekend-engagement",
      "optimal": "Optimalt tidspunkt"
    },
    "cta": {
      "booking": "🔔 Book bord",
      "event": "🎉 Event",
      "engagement": "💬 Interaktion",
      "awareness": "👁️ Del",
      "traffic": "⚡ Kør trafik",
      "default": "✨ Kom forbi"
    },
    "status": {
      "draft": "Kladde",
      "approved": "Godkendt",
      "scheduled": "Planlagt",
      "posted": "Postet"
    }
  },
  "detail": {
    "title": "Post Specifikation",
    "timeAt": "kl.",
    "pastTitle": "Post planlagt i fortiden",
    "pastDesc": "Dette post er planlagt til {{date}} kl. {{time}}, som er passeret. Du kan omplanlægge posten til en ny dato nedenfor.",
    "reschedule": "📅 Flyt til næste uge (+7 dage)",
    "whyPost": "💡 Hvorfor dette post?",
    "timingSection": "📅 Timing",
    "day": "Dag",
    "date": "Dato",
    "time": "Tid",
    "rationale": "Rationale",
    "platform": "📱 Platform & Format",
    "platformLabel": "Platform",
    "format": "Format",
    "platformRationale": "Platform Rationale",
    "formatRationale": "Format Rationale",
    "postType": "📝 Post Type",
    "type": "Type",
    "category": "Kategori",
    "priority": "Prioritet",
    "reasons": "Grunde",
    "content": "🎯 Indhold",
    "whyThisDish": "Hvorfor denne ret:",
    "caption": "💬 Caption",
    "aiGenerated": "AI Genereret",
    "generatingCaption": "Genererer...",
    "regenerate": "Regenerer",
    "regenerateTitle": "Generer ny caption med AI",
    "editCaption": "Rediger",
    "characters": "{{count}} tegn",
    "cancelEdit": "Annuller",
    "save": "Gem",
    "hashtags": "Hashtags:",
    "quality": "Kvalitet:",
    "visualDirection": "📸 Visuel Retning",
    "subject": "Motiv",
    "angle": "Vinkel",
    "setting": "Setting",
    "lighting": "Lys",
    "styling": "Styling",
    "context": "Kontekst",
    "technicalSpecs": "Tekniske specs",
    "fileFormat": "Format:",
    "dimensions": "Størrelse:",
    "aspectRatio": "Ratio:",
    "media": "📦 Medie",
    "uploading": "Uploader...",
    "uploadMedia": "Upload foto/video",
    "dragDrop": "eller træk og slip her",
    "replaceImage": "Erstat billede",
    "exportBrief": "Eksporter Fotograf Brief (PDF)",
    "productionNotes": "⏱️ Produktionsnoter",
    "estimatedTime": "Estimeret tid",
    "logistics": "Logistik",
    "alternatives": "🔄 Alternativer",
    "altPrefix": "Alt {{n}}:",
    "statusLabel": "Status:",
    "statusDraft": "Kladde",
    "statusApproved": "Godkendt",
    "statusScheduled": "Planlagt",
    "statusPosted": "Postet",
    "close": "Luk",
    "approve": "Godkend Opslag",
    "uploadError": "Kunne ikke uploade fil. Prøv igen."
  }
}

def add_keys(locale, new_keys, namespace):
    if namespace not in locale:
        locale[namespace] = {}
    for k, v in new_keys.items():
        if k not in locale[namespace]:
            locale[namespace][k] = v
            print(f"  Added {namespace}.{k}")
        else:
            print(f"  Exists {namespace}.{k}")

with open(EN_PATH) as f:
    en = json.load(f)
with open(DA_PATH) as f:
    da = json.load(f)

print("=== EN ===")
add_keys(en, EN_KEYS, "weeklyPlan")
print("\n=== DA ===")
add_keys(da, DA_KEYS, "weeklyPlan")

with open(EN_PATH, "w") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)
with open(DA_PATH, "w") as f:
    json.dump(da, f, ensure_ascii=False, indent=2)

print("\nDone.")
