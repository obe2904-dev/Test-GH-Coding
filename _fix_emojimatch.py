path = "/Users/olebaek/Test P2G 1/supabase/functions/analyze-photo/prompts.ts"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ── DA: replace emojiMatch section ──────────────────────────────────────────
old_da = (
    "KRAV TIL EMOJIMATCH:\n"
    "EmojiMatch vurderer KUN om emojis i teksten matcher det billedet faktisk viser \u2013 uafh\u00e6ngigt af om den skrevne tekst matcher.\n"
    "- S\u00e6t emojiMatch til null hvis: der ikke er nogen emojis i teksten, eller emojierne passer til det billedet viser.\n"
    "- S\u00e6t emojiMatch til en kort s\u00e6tning hvis: en emoji tydeligt repr\u00e6senterer noget andet end det billedet viser.\n"
    "- V\u00e6r konkret: n\u00e6vn hvilken emoji der er brugt og hvad billedet viser i stedet.\n"
    "- \u274c Generisk: \"Emojien matcher ikke billedet.\"\n"
    "- \u2705 Specifik: \"Teksten bruger \u2615 men billedet viser \u00f8l \u2013 skift emoji til en der passer.\"\n"
    "- Bland ALDRIG billedkvalitet eller tekstindhold ind \u2013 kun emoji-versus-billede."
)
new_da = (
    "KRAV TIL EMOJIMATCH:\n"
    "EmojiMatch vurderer om mad- og drikkeemojis i teksten matcher det der FAKTISK ER SYNLIGT p\u00e5 billedet.\n"
    "\n"
    "Fremgangsm\u00e5de (g\u00f8r dette for HVER emoji i teksten):\n"
    "1. Identificer emojien og hvad den BOGSTAVELIGT LIT repr\u00e6senterer (f.eks. \u2615 = kaffe, \ud83c\udf77 = vin, \ud83c\udf55 = pizza).\n"
    "2. Er det p\u00e5g\u00e6ldende objekt synligt p\u00e5 billedet? Ja \u2192 match. Nej \u2192 mismatch.\n"
    "3. Atmosf\u00e6re er IKKE en undskyldning: \u2615 betyder kaffe-i-kop, ikke \"hyggelig stemning\". Billedet skal vise reel kaffe.\n"
    "\n"
    "- S\u00e6t emojiMatch til null hvis: ingen emojis i teksten, eller alle emojis matcher det billedet viser.\n"
    "- S\u00e6t emojiMatch til en konkret s\u00e6tning hvis: en emoji viser noget der IKKE er synligt p\u00e5 billedet.\n"
    "- N\u00e6vn specifikt hvilken emoji og hvad billedet viser i stedet.\n"
    "- \u274c Forkert: emojiMatch = null n\u00e5r teksten bruger \u2615 men billedet viser en middagsret med vin.\n"
    "- \u274c Generisk: \"Emojien matcher ikke billedet.\"\n"
    "- \u2705 Korrekt: \"Teksten bruger \u2615\ufe0f men billedet viser b\u00f8f og vin \u2013 brug f.eks. \ud83e\udd69 eller \ud83c\udf77 i stedet.\"\n"
    "- Bland ALDRIG billedkvalitet eller den skrevne tekst ind \u2013 kun emoji-versus-billede."
)

if old_da in content:
    content = content.replace(old_da, new_da, 1)
    print("DA emojiMatch: replaced OK")
else:
    print("DA emojiMatch: NOT FOUND")
    for i, line in enumerate(old_da.split('\n')):
        if line and line not in content:
            print(f"  MISSING line {i}: {repr(line[:100])}")

# ── EN: replace emojiMatch section ──────────────────────────────────────────
old_en = (
    "REQUIREMENT FOR EMOJIMATCH:\n"
    "EmojiMatch evaluates ONLY whether the emojis in the text match what the image actually shows \u2014 independent of whether the written text matches.\n"
    "- Set emojiMatch to null if: there are no emojis in the text, or the emojis accurately represent what the image shows.\n"
    "- Set emojiMatch to a short sentence if: an emoji clearly represents something different from what the image shows.\n"
    "- Be specific: name which emoji was used and what the image shows instead.\n"
    "- \u274c Generic: \"The emoji doesn\u2019t match the image.\"\n"
    "- \u2705 Specific: \"The text uses \u2615 but the image shows beer \u2014 swap the emoji to match.\"\n"
    "- NEVER mix image quality or text content in \u2014 only emoji versus image."
)
new_en = (
    "REQUIREMENT FOR EMOJIMATCH:\n"
    "EmojiMatch evaluates whether food and drink emojis in the text match what is ACTUALLY VISIBLE in the image.\n"
    "\n"
    "Process (do this for EACH emoji in the text):\n"
    "1. Identify the emoji and what it LITERALLY represents (e.g. \u2615 = coffee, \ud83c\udf77 = wine, \ud83c\udf55 = pizza).\n"
    "2. Is that specific item visible in the image? Yes \u2192 match. No \u2192 mismatch.\n"
    "3. Atmosphere is NOT an excuse: \u2615 means coffee-in-a-cup, not \"cosy vibe\". The image must show actual coffee.\n"
    "\n"
    "- Set emojiMatch to null if: no emojis in the text, or all emojis match what the image shows.\n"
    "- Set emojiMatch to a concrete sentence if: an emoji depicts something NOT visible in the image.\n"
    "- Name specifically which emoji and what the image shows instead.\n"
    "- \u274c Wrong: emojiMatch = null when the text uses \u2615 but the image shows a dinner plate with beef and wine.\n"
    "- \u274c Generic: \"The emoji doesn\u2019t match the image.\"\n"
    "- \u2705 Correct: \"The text uses \u2615\ufe0f but the image shows beef and wine \u2014 use \ud83e\udd69 or \ud83c\udf77 instead.\"\n"
    "- NEVER mix image quality or the written text content in \u2014 only emoji versus image."
)

if old_en in content:
    content = content.replace(old_en, new_en, 1)
    print("EN emojiMatch: replaced OK")
else:
    print("EN emojiMatch: NOT FOUND")
    for i, line in enumerate(old_en.split('\n')):
        if line and line not in content:
            print(f"  MISSING line {i}: {repr(line[:100])}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
