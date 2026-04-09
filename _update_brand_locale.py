import json

with open('src/lib/locales/en.json', encoding='utf-8') as f:
    en = json.load(f)
with open('src/lib/locales/da.json', encoding='utf-8') as f:
    da = json.load(f)

en['brand'] = {
  "page": {
    "generating": "Generating brand profile...",
    "loading": "Loading brand profile...",
    "errorTitle": "Error",
    "title": "Brand Profile",
    "subtitle": "Your AI-generated brand identity and communication guide",
    "noBusiness": "No business found. Contact support if the problem persists."
  },
  "generator": {
    "title": "Generate your Brand Profile",
    "description": "Our AI analyses your business, menu and location to create an authentic brand profile that matches your identity.",
    "includes": "Your profile includes:",
    "item": {
      "essence": "Your unique identity in one sentence",
      "tone": "How you communicate",
      "hooks": "Specific angles for your posts",
      "banned": "Words that sound generic or inauthentic",
      "audience": "Who you're talking to",
      "positioning": "What makes you unique"
    },
    "error": "Error:",
    "generating": "Generating...",
    "button": "✨ Generate Brand Profile",
    "timeEstimate": "Takes approx. 15\u201325 seconds"
  },
  "progress": {
    "defaultMessage": "Generating brand profile...",
    "subtitle": "This typically takes 15\u201325 seconds",
    "step1": "Collecting business data...",
    "step2": "Analysing menu and location...",
    "step3": "Generating brand identity with AI..."
  },
  "display": {
    "regenerate": "\U0001f504 Regenerate",
    "group1Badge": "Group 1 \u00b7 Identity \u00b7 Read on every generation",
    "businessType": "Business type",
    "hideDetails": "Hide details",
    "showPositioning": "Show positioning",
    "humor": {
      "low": "Serious",
      "moderate": "Mildly humorous",
      "high": "Humorous"
    },
    "voice": {
      "title": "Voice",
      "badge": "Read on every generation",
      "legacyWarning": "\u26a0\ufe0f Old format \u2014 regenerate profile for rule-based tone guide",
      "rationale": "How these voice principles were derived",
      "typicalOpening": "\u2705 Typical opening",
      "humorLabel": "\U0001f604 Humour"
    },
    "pillars": {
      "title": "Content Pillars",
      "badge": "Read on every generation",
      "empty": "No content pillars found \u2014 regenerate profile."
    },
    "limits": {
      "title": "Limits",
      "badge": "Read on every generation",
      "principle": "\u26a0\ufe0f Writing principle",
      "avoid": "\u274c Avoid e.g.",
      "signature": "\u2728 Signature phrases",
      "copy": "Click to copy",
      "empty": "No limits defined \u2014 regenerate profile."
    },
    "strategy": {
      "title": "Post Strategy",
      "badge": "Drives weekly post mix",
      "goals": {
        "drive_footfall": "Footfall strategy",
        "build_brand": "Brand building",
        "retain_loyalty": "Loyalty strategy"
      },
      "primaryGoal": "Primary goal",
      "goalBlend": "Goal distribution",
      "rationaleTitle": "\U0001f4a1 Why this strategy?",
      "signalsTitle": "Signals behind the strategy",
      "tips": {
        "footfall": "Footfall signal",
        "brand": "Brand anchor",
        "loyalty": "Loyalty hook"
      },
      "rationale": {
        "footfall_with_signals": "**{{label}} ({{pct}}%)** chosen as primary goal because the business has clear footfall signals: {{signals}}.",
        "footfall_no_signals": "**{{label}} ({{pct}}%)** is primary goal \u2014 business type attracts guests via concrete visit occasions.",
        "brand_with_anchors": "**{{label}} ({{pct}}%)** prioritised because the business's signature elements \u2014 {{anchors}} \u2014 require a clear online identity.",
        "brand_no_anchors": "**{{label}} ({{pct}}%)** included to build visual and editorial identity over time.",
        "loyalty_with_hooks": "**{{label}} ({{pct}}%)** supported by returning guests and habits: {{hooks}}.",
        "loyalty_no_hooks": "**{{label}} ({{pct}}%)** keeps regulars engaged between visits."
      }
    },
    "background": {
      "title": "Background context",
      "audience": "Target audience",
      "unverified": "not verified",
      "samplePosts": "Sample posts",
      "generatorInput": "used as generator input",
      "story": "Brand story",
      "ourStory": "Our story",
      "differentiator": "What sets us apart"
    }
  }
}

da['brand'] = {
  "page": {
    "generating": "Genererer brandprofil...",
    "loading": "Henter brandprofil...",
    "errorTitle": "Fejl",
    "title": "Brand Profil",
    "subtitle": "Din AI-genererede brandidentitet og kommunikationsguide",
    "noBusiness": "Ingen forretning fundet. Kontakt support hvis problemet forts\u00e6tter."
  },
  "generator": {
    "title": "Generer din Brandprofil",
    "description": "Vores AI analyserer din forretning, menu og lokation for at skabe en autentisk brandprofil der matcher din identitet.",
    "includes": "Din profil inkluderer:",
    "item": {
      "essence": "Din unikke identitet p\u00e5 \u00e9t s\u00e6tning",
      "tone": "Hvordan du kommunikerer",
      "hooks": "Specifikke vinkler til dine opslag",
      "banned": "Ord der lyder generiske eller u\u00e6gte",
      "audience": "Hvem du taler til",
      "positioning": "Hvad g\u00f8r dig unik"
    },
    "error": "Fejl:",
    "generating": "Genererer...",
    "button": "✨ Generer Brandprofil",
    "timeEstimate": "Tager ca. 15-25 sekunder"
  },
  "progress": {
    "defaultMessage": "Genererer brandprofil...",
    "subtitle": "Dette tager typisk 15-25 sekunder",
    "step1": "Indsamler forretningsdata...",
    "step2": "Analyserer menu og lokation...",
    "step3": "Genererer brandidentitet med AI..."
  },
  "display": {
    "regenerate": "\U0001f504 Generer igen",
    "group1Badge": "Gruppe 1 \u00b7 Identitet \u00b7 L\u00e6ses ved hver generering",
    "businessType": "Forretningstype",
    "hideDetails": "Skjul detaljer",
    "showPositioning": "Vis positionering",
    "humor": {
      "low": "Seri\u00f8s",
      "moderate": "Let humoristisk",
      "high": "Humoristisk"
    },
    "voice": {
      "title": "Stemme",
      "badge": "L\u00e6ses ved hver generering",
      "legacyWarning": "\u26a0\ufe0f Gammel format \u2014 generer profilen igen for at f\u00e5 regelbaseret tone-guide",
      "rationale": "S\u00e5dan er stemmeprincipperne udledt",
      "typicalOpening": "\u2705 Typisk \u00e5bning",
      "humorLabel": "\U0001f604 Humor"
    },
    "pillars": {
      "title": "Content Pillars",
      "badge": "L\u00e6ses ved hver generering",
      "empty": "Ingen content pillars fundet \u2014 generer profilen igen."
    },
    "limits": {
      "title": "Gr\u00e6nser",
      "badge": "L\u00e6ses ved hver generering",
      "principle": "\u26a0\ufe0f Skriveprincip",
      "avoid": "\u274c Undg\u00e5 fx",
      "signature": "\u2728 Signatur-fraser",
      "copy": "Klik for at kopiere",
      "empty": "Ingen gr\u00e6nser defineret \u2014 generer profilen igen."
    },
    "strategy": {
      "title": "Post Strategi",
      "badge": "Styrer ugentlig post-mix",
      "goals": {
        "drive_footfall": "Tiltr\u00e6kningsstrategi",
        "build_brand": "Brandopbygning",
        "retain_loyalty": "Loyalitetstrategi"
      },
      "primaryGoal": "Prim\u00e6rt m\u00e5l",
      "goalBlend": "M\u00e5l-fordeling",
      "rationaleTitle": "\U0001f4a1 Hvorfor denne strategi?",
      "signalsTitle": "Signaler bag strategien",
      "tips": {
        "footfall": "Bes\u00f8gssignal",
        "brand": "Brand-anker",
        "loyalty": "Loyalitetshook"
      },
      "rationale": {
        "footfall_with_signals": "**{{label}} ({{pct}}%)** er valgt som prim\u00e6rt m\u00e5l fordi forretningen har klare bes\u00f8gssignaler: {{signals}}.",
        "footfall_no_signals": "**{{label}} ({{pct}}%)** er prim\u00e6rt m\u00e5l \u2014 forretningstypen tr\u00e6kker g\u00e6ster via konkrete bes\u00f8gsanledninger.",
        "brand_with_anchors": "**{{label}} ({{pct}}%)** prioriteres fordi forretningens signatur-elementer \u2014 {{anchors}} \u2014 kr\u00e6ver tydelig online identitet.",
        "brand_no_anchors": "**{{label}} ({{pct}}%)** er inkluderet for at styrke den visuelle og redaktionelle identitet over tid.",
        "loyalty_with_hooks": "**{{label}} ({{pct}}%)** underst\u00f8ttes af tilbagevendende g\u00e6ster og vaner: {{hooks}}.",
        "loyalty_no_hooks": "**{{label}} ({{pct}}%)** holder stamg\u00e6sterne engagerede mellem bes\u00f8g."
      }
    },
    "background": {
      "title": "Baggrundskontekst",
      "audience": "M\u00e5lgruppe",
      "unverified": "ikke verificeret",
      "samplePosts": "Eksempel-opslag",
      "generatorInput": "bruges som generator-input",
      "story": "Brand-historie",
      "ourStory": "Vores historie",
      "differentiator": "Hvad skiller os ud"
    }
  }
}

with open('src/lib/locales/en.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, indent=2, ensure_ascii=False)
    f.write('\n')
with open('src/lib/locales/da.json', 'w', encoding='utf-8') as f:
    json.dump(da, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('Done')
