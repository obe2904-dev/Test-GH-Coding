/**
 * JSON schema for Prompt B structured outputs.
 * Extracted from prompt-b.ts (v4.14.0).
 */

/**
 * JSON schema for structured outputs.
 * Used as a behavioral contract embedded in the user prompt.
 * Field `description` strings are the primary mechanism for guiding AI behavior.
 */
export const BRAND_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    voice_rationale: {
      type: "string",
      description: "Write this FIRST, before deriving tone_of_voice rules. 3–6 sentences in plain Danish for the business owner explaining how the Voice rules were derived. Cover: (1) what signals were AVAILABLE — website copy quality ('ingen løbende tekst', 'sparse', 'abundant'), menu character (named suppliers, hjemmelavet, etc.), location anchor, price register, occasion arc (opening–closing span), audience signals; (2) what the dominant voice implication is for THIS specific business and why it differs from a generic business of the same type; (3) whether the rules derive from OBSERVED text patterns (Path A) or are INFERRED from situational signals (Path B) — be honest. If evidence is thin, say so. BANNED: vague filler like 'vi har analyseret din virksomhed'. Every sentence must contain a concrete signal. Do NOT copy example wording — use the actual business data. Example of FORMAT (not content): 'Stemmereglerne er primært udledt af stedets situationelle signaler: åen som atmosfærisk anker, gentagne Hjemmelavet-ingredienser og en åbningstid fra 09:30 til 02:00. Hjemmesiden indeholder ingen løbende tekst at observere rytme fra, så reglerne er situationsbaserede snarere end tekstbaserede. Prislaget (mid) kombineret med børnemenu signalerer en bred og inkluderende gæst — stemmen skal undgå eksklusivitetssignaler. Dagsprogrammet fra morgenbrunch til nattetimer betyder, at stemmen bærer begge yderpunkter.'.",
      maxLength: 700
    },
    brand_essence: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "ONE sentence: venue type + location + offering category + EXACTLY ONE behavioral hook (flow/duration/tempo). Pattern: '[Venue] [location] hvor [offerings] kan nydes [hook].' Example: 'Café ved åen i Aarhus hvor mad og oplevelser kan nydes i roligt tempo.' Hook must describe flow/tempo/duration — NOT a menu item, NOT location alone. BANNED: 'lækker', 'hyggelig', 'afslappet', 'autentisk', 'unik'. NOTE: this field is post-processed — focus your energy on other fields.",
          maxLength: 500,
          pattern: ".*(ved åen|ved stationen|på gågaden|i centrum|i kvarteret|ved [A-ZÆØÅ][a-zæøå]+|i turistområdet).*"
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3,
          description: "1-3 bullets proving which Prompt A hooks/phrases were used"
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    brand_essence_elaboration: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "2–3 sentences answering: why would a guest choose THIS over the next café/restaurant of the same type? Use this scaffold — Sentence 1: '[Business name] er et oplagt valg [specific occasion type] fordi [location anchor + price register + menu signal] giver det [specific competitive trait] — ikke som det eneste option, men som det [qualifier] valg.' Sentence 2: one concrete confirming detail specific to this venue that a competitor on the next street could NOT claim. HARD RULE: do not write 'Om dagen', 'Om aftenen', 'forvandles', 'skifter til' — the programme is already captured in business_character. Write the competitive WHY, not the operational WHAT. BANNED: lækker, unik, autentisk, hyggelig, charmerende, afslappet.",
          maxLength: 600
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    identity_keywords: {
      type: "array",
      items: { type: "string", maxLength: 30 },
      minItems: 3,
      maxItems: 3,
      description: "Exactly 3 IDENTITY keywords describing WHO/WHAT the business IS — NOT how it writes. Each must pull in a different direction: one atmosphere dimension + one formality dimension + one category/format dimension. ANTI-PATTERN: 'Hygge · Samvær · Fællesskab' (all synonymous). CORRECT example: 'Hygge · Uformel · Klassikere'. MUST NOT overlap with tone_model.primary_keywords (which describe writing style, not identity)."
    },
    business_character: {
      type: "string",
      description: "1–2 sentences of plain factual text describing what this business actually is. Cover: (1) all venue types or roles when a hybrid — list each e.g. 'café, restaurant og bar'; (2) defining physical features that create content opportunities e.g. 'med stor udendørs terrasse', 'med havudsigt', 'i en gammel fabrikshal'; (3) key temporal formats or transitions if relevant. Not marketing language. Must let an AI infer content priorities without any other context. Example 1: 'Café, restaurant og bar med udendørs siddepladser, der serverer kaffe og brunch om dagen og skifter til mad og drinks om aftenen.' Example 2: 'Klassisk dansk restaurant med fokus på smørrebrød til frokost og moderne aftenmenu.' Example 3: 'Specialty kaffebar med travl morgenstemning og rolig eftermiddagskarakter — primær take-away men med få indeplær en.'" ,
      maxLength: 350
    },
    tone_of_voice: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Two-part format. Part 1 — STEMME-MEKANIK: 2–3 portable mechanics rules (apply to any text). Part 2 — STEMME-IDENTITET: 2–3 posture rules that are specific to THIS business and must name the SIGNAL PROFILE signal they come from. Then Eksempel: lines. REQUIRED FORMAT:\nSTEMME-MEKANIK:\n- [mekanik-regel]\n- [mekanik-regel]\nSTEMME-IDENTITET:\n- [identitetsregel — (signal: venue_type/price_register/meal_arc/location)]\n- [identitetsregel — (signal: ...)]\nEksempel: \"[eksempel 1]\"\nEksempel: \"[eksempel 2]\"\nFALSIFICERINGSTEST for STEMME-IDENTITET: Kan en naborestaurant bruge denne regel om sig selv uden at lyve? Ja → kassér og omskriv.",
          maxLength: 1100
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    tone_model: {
      type: "object",
      properties: {
        primary_keywords: {
          type: "array",
          items: { type: "string", maxLength: 30 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 core tone adjectives (e.g. 'rolig', 'jordnær', 'uformel'). Keep between 2-6."
        },
        writing_rules: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 8,
          description: "3-8 actionable writing rules about STYLE ONLY — sentence rhythm, tone register, punctuation, du/vi/man usage, sentence length. FORBIDDEN: dish names, location markers, specific menu items (e.g. 'carpaccio', 'ved åen'). Rules must apply to ANY business of this type, not just this one. Keep between 3-8."
        },
        good_examples: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 example phrases that DEMONSTRATE WRITING STYLE ONLY — rhythm, sentence length, and register. FORBIDDEN: dish names, location markers, specific menu items, prices. A reader should not be able to identify the business from these examples alone. Keep between 2-6."
        },
        avoid_examples: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 example phrases to avoid with brief reason. Keep between 2-6."
        },
        formality: {
          type: "string",
          enum: ["formal", "informal", "mixed"]
        },
        emoji_level: {
          type: "string",
          enum: ["none", "minimal", "moderate", "frequent"]
        },
        version: { type: "string", enum: ["2.0"] },
        language: { type: "string", minLength: 2, maxLength: 5 },
        generated_at: { type: "string" },
        source: { type: "string", enum: ["website", "manual", "hybrid"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        notes: { type: "string", maxLength: 500 }
      },
      required: ["primary_keywords", "writing_rules", "good_examples", "avoid_examples", "formality", "emoji_level", "version", "language", "generated_at", "source", "confidence"],
      additionalProperties: false
    },
    target_audience: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "MULTI-AUDIENCE behavioral format. Write 2-4 occasions using 'Når gæster...' phrasing, drawing from BOTH usage_occasions AND concurrent visitor types (category_scores ≥40 each earn one clause). ALLOWED: 'børn kan spise med', 'mellem møder', 'med god tid'. Score-gated: 'besøgende' only if tourist_strength=secondary/primary in data. ALWAYS BANNED: 'familier', 'par', 'venner', 'lokale', 'unge'. Pattern: 'Når gæster [behavior], når [situation], samt når [transition]'. Min 2, max 4 occasions.",
          maxLength: 500
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    core_offerings: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Bulleted list: 3 meal CATEGORY anchors (e.g. 'Brunch med klassiske morgenmadsretter', 'Frokost og smørrebrød', 'Middagsmenuer') + 2 experience/service anchors (e.g. 'Udendørs terrasse', 'Take away'). Use MEAL CATEGORIES — NOT specific dish names or menu item names from the menu. Each bullet should describe a CATEGORY of offering, not a specific item.",
          maxLength: 800
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    content_focus: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "USAGE-DRIVEN content themes. 3-5 bullets covering: (1) food/service, (2) atmosphere/flow, (3) behavioral moments. DERIVE FROM content_triggers what_to_show and copy_angles. Multi-signal threshold: if ≥2 different signal types support a theme, treat as SUFFICIENT. Example: 'Retter der deles og bliver stående på bordet, overgangen fra dag til aften ved åen, samt lange ophold med flere bestillinger'",
          maxLength: 600
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    content_pillars: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      description: "3-6 content pillars",
      items: {
        type: "object",
        properties: {
          pillar: {
            type: "string",
            enum: ["Crave-worthy", "BTS", "Social proof", "Vibe", "Engagement", "Offers"]
          },
          allowed: { type: "boolean" },
          encouraged: { type: "boolean" },
          notes: { type: "string", maxLength: 220 }
        },
        required: ["pillar", "allowed", "encouraged", "notes"],
        additionalProperties: false
      }
    },
    image_preferences: {
      type: "object",
      properties: {
        dos: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 3,
          maxItems: 3,
          description: "3 visual best practices specific to this venue"
        },
        donts: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 3,
          maxItems: 3,
          description: "3 visual anti-patterns. Focus on: stock photo feel, tone mismatches. DO NOT ban legitimate content types (menu shots, BTS, solo products, indoor shots)."
        },
        signature_shot: {
          type: "string",
          maxLength: 300,
          description: "One iconic shot description. MUST include location context (ved åen/ved vinduet/på gågaden/i kvarteret/ved bordet ved åen).",
          pattern: ".*(ved åen|ved vinduet|ved bordet ved åen|på gågaden|med gågade|i kvarteret|i centrum|ved [A-ZÆØÅ][a-zæøå]+|med ikonisk udsigt).*"
        }
      },
      required: ["dos", "donts", "signature_shot"],
      additionalProperties: false
    },
    things_to_avoid: {
      type: "object",
      properties: {
        language_constraints: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 2,
          maxItems: 8,
          description: "Language/tone bans: specific words/phrases or hype patterns to avoid"
        },
        factual_constraints: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 2,
          maxItems: 8,
          description: "Factual guardrails: do NOT invent events/offers/music/discounts/opening hours unless explicitly evidenced"
        }
      },
      required: ["language_constraints", "factual_constraints"],
      additionalProperties: false
    },
    voice_constraints: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "ONE principle sentence explaining WHY this tone/style matters for this specific business — not a list of forbidden words, but a principle that gives AI enough to reason from. Example: 'Undgå ord der lyder som de hører hjemme i et reklamefirma — dette sted kommunikerer som en person, ikke en kampagne.' Should be specific to THIS business's identity and brand_essence.",
          maxLength: 300
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 2
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    cta_style: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Define BOTH primary CTA (booking/reservation) AND 2-3 secondary soft CTAs (se menu, kig forbi, del oplevelsen). Use actual CTA verbs found on website.",
          maxLength: 500
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    communication_goal: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Desired positioning or performance goal",
          maxLength: 400
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    content_strategy: {
      type: "object",
      description: "Content strategy for this business: goal mode split and content category weights. Derive from business type, footfall signals, brand anchors, and loyalty hooks found in the data.",
      properties: {
        primary_goal: {
          type: "string",
          enum: ["drive_footfall", "build_brand", "retain_loyalty"],
          description: "The single dominant social-media goal for this business. drive_footfall = get people through the door; build_brand = distinctive identity and awareness; retain_loyalty = keep regulars engaged."
        },
        goal_blend: {
          type: "object",
          properties: {
            drive_footfall: { type: "number", minimum: 0, maximum: 100 },
            build_brand: { type: "number", minimum: 0, maximum: 100 },
            retain_loyalty: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["drive_footfall", "build_brand", "retain_loyalty"],
          additionalProperties: false,
          description: "Percentage split across the three goal modes. MUST sum to 100. Example for a destination dining restaurant: drive_footfall=50, build_brand=30, retain_loyalty=20."
        },
        footfall_signals: {
          type: "array",
          items: { type: "string", maxLength: 80 },
          minItems: 1,
          maxItems: 4,
          description: "Concrete signals justifying footfall-focused posts. F.eks. 'weekendmiddage', 'sæsonterrassetrafik', 'turistdestination'."
        },
        brand_anchors: {
          type: "array",
          items: { type: "string", maxLength: 80 },
          minItems: 1,
          maxItems: 4,
          description: "Core identity anchors to reinforce in brand-building posts. F.eks. 'køkkenets håndværk', 'sæsonbaserede råvarer', 'naturvin-selektion'."
        },
        loyalty_hooks: {
          type: "array",
          items: { type: "string", maxLength: 80 },
          minItems: 1,
          maxItems: 4,
          description: "Recurring reasons regulars return. F.eks. 'faste bargæster', 'ugentlig brunchtradition', 'kendte ansigter'."
        },
        content_category_weights: {
          type: "object",
          properties: {
            product_menu: { type: "number", minimum: 0, maximum: 100 },
            craving_visual: { type: "number", minimum: 0, maximum: 100 },
            behind_scenes: { type: "number", minimum: 0, maximum: 100 },
            team_people: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["product_menu", "craving_visual", "behind_scenes", "team_people"],
          additionalProperties: false,
          description: "Percentage weight per content category. MUST sum to 100. product_menu=dish-specific posts with menu detail; craving_visual=sensory food shots without operational detail; behind_scenes=kitchen/prep scenes; team_people=staff personality."
        }
      },
      required: ["primary_goal", "goal_blend", "footfall_signals", "brand_anchors", "loyalty_hooks", "content_category_weights"],
      additionalProperties: false
    },
    recognizable_interior_identity: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "CONDITIONAL: Only populate if explicit visual evidence exists (interior photos, labeled images). Include: murals, wall art, iconic figures, distinctive interior elements. Leave EMPTY if no verified evidence.",
          maxLength: 600
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 0,
          maxItems: 5
        },
        has_verified_evidence: {
          type: "boolean",
          description: "Set true ONLY if interior photos or explicit visual descriptions exist. False if uncertain."
        }
      },
      required: ["has_verified_evidence"],
      additionalProperties: false
    },
    internal_notes: {
      type: "array",
      items: { type: "string", maxLength: 300 }
    },
    clarifications_needed: {
      type: "array",
      items: { type: "string", maxLength: 200 }
    },
    social_style: {
      type: "object",
      properties: {
        emoji_usage: {
          type: "string",
          enum: ["none", "minimal", "moderate", "expressive"],
          description: "none=formal/serious, minimal=1-2 (optimal for most), moderate=3-5 (casual), expressive=5+ (youth only)"
        },
        emoji_examples: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 6,
          description: "3-6 high-performing, on-brand emojis"
        },
        hashtag_strategy: {
          type: "object",
          properties: {
            branded: { type: "array", items: { type: "string" } },
            category: { type: "array", items: { type: "string" } },
            local: { type: "array", items: { type: "string" } }
          },
          required: ["branded", "category", "local"],
          additionalProperties: false
        }
      },
      required: ["emoji_usage", "emoji_examples", "hashtag_strategy"],
      additionalProperties: false
    },
    voice_examples: {
      type: "object",
      properties: {
        do_say: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 5,
          description: "3-5 brand-authentic example phrases for DISPLAY to business owner — SHOULD include location anchors, CTAs, and specific tone signals. Place LOCATION MARKETING HOOKS here verbatim. NOT used for AI caption generation — only shown to the user so they can see what their brand voice sounds like."
        },
        dont_say: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 5,
          description: "3-5 example phrases this brand would NEVER use (wrong tone, too generic, wrong personality)"
        },
        vocabulary: {
          type: "object",
          properties: {
            prefer: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
              maxItems: 10,
              description: "5-10 words that fit this brand's voice"
            },
            avoid: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
              maxItems: 10,
              description: "5-10 words that don't fit this brand"
            }
          },
          required: ["prefer", "avoid"],
          additionalProperties: false
        }
      },
      required: ["do_say", "dont_say", "vocabulary"],
      additionalProperties: false
    }
  },
  required: [
    "brand_essence", "brand_essence_elaboration", "identity_keywords",
    "business_character", "voice_rationale",
    "tone_of_voice", "tone_model", "target_audience", "core_offerings",
    "content_focus", "content_pillars", "image_preferences", "things_to_avoid",
    "voice_constraints", "cta_style", "communication_goal", "content_strategy", "recognizable_interior_identity",
    "social_style", "voice_examples", "internal_notes", "clarifications_needed"
  ],
  additionalProperties: false
}

