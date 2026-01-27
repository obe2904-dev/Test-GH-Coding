#!/usr/bin/env python3

# Read the file
with open('/Users/olebaek/Test P2G 1/supabase/functions/ai-generate/index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the function start
start_idx = None
for i, line in enumerate(lines):
    if 'function getIdeasSystemPrompt(lang:' in line:
        start_idx = i
        break

if start_idx is None:
    print("Could not find function")
    exit(1)

# Find where the Danish prompt starts (after `if (lang === 'da') {`)
da_start = None
for i in range(start_idx, len(lines)):
    if "if (lang === 'da')" in lines[i]:
        # The prompt starts on the return line (next line or two)
        for j in range(i, i+3):
            if 'return `' in lines[j]:
                da_start = j
                break
        break

# Find where the Danish prompt ends (look for the closing backtick and brace)
da_end = None
for i in range(da_start, len(lines)):
    if '`' in lines[i] and '}' in lines[i+1]:
        da_end = i
        break

# Find where the English prompt starts
en_start = da_end + 2  # Skip the closing brace and blank line
for i in range(da_end, len(lines)):
    if 'return `' in lines[i] and i > da_end + 1:
        en_start = i
        break

# Find where the English prompt/function ends  
en_end = None
for i in range(en_start, len(lines)):
    if '`' in lines[i] and '\n}' in lines[i]:
        en_end = i
        break

# New Danish prompt
da_prompt_lines = [
    '    return `Du er en dansk SoMe-copywriter for små virksomheder.\n',
    '\n',
    'OUTPUT:\n',
    '- Returnér KUN gyldig JSON. Ingen markdown. Ingen forklaringer.\n',
    '\n',
    'PRIORITERING:\n',
    '  1. UFRAVIGELIGE REGLER (hvis de findes)\n',
    '  2. BRANDPROFIL (højeste prioritet)\n',
    '  3. DRIFTSREGLER FOR INDHOLD\n',
    '  4. VIRKSOMHEDSKONTEKST\n',
    '  5. EKSTRA KONTEKST\n',
    '\n',
    'MENUPUNKTER:\n',
    '- Kopiér rettenavne præcis som angivet (tegn-for-tegn).\n',
    '- Opfind aldrig retter. Oversæt aldrig. Omformuler aldrig.\n',
    '- I kundevendt tekst: brug kun rettenavnet UDEN eventuel kategori i parentes.\n',
    '\n',
    'STIL:\n',
    '- Naturligt dansk (ikke "oversat" US marketing-sprog).\n',
    '- Undgå klichéer ("Forestil dig...", "Tag en pause...").\n',
    '- Variér startord på tværs af de 3 ideer.\n',
    '- Maks. ÉT udråbstegn (!) per idé.\n',
    '- Konkrete detaljer > generiske tillægsord.`\n'
]

# New English prompt
en_prompt_lines = [
    '  return `You are a social media copywriter for small businesses.\n',
    '\n',
    'OUTPUT:\n',
    '- Return ONLY valid JSON. No markdown. No explanations.\n',
    '\n',
    'PRIORITY:\n',
    '  1. HARD RULES (if present)\n',
    '  2. BRAND PROFILE (highest priority)\n',
    '  3. OPERATIONAL CONTENT RULES\n',
    '  4. BUSINESS CONTEXT\n',
    '  5. OPTIONAL CONTEXT\n',
    '\n',
    'MENU ITEMS:\n',
    '- Copy dish names exactly as provided (character-for-character).\n',
    '- Never invent dishes. Never translate. Never paraphrase.\n',
    '- In customer-facing text: use only the dish name WITHOUT any category suffix in parentheses.\n',
    '\n',
    'STYLE:\n',
    '- Natural English (avoid marketing clichés).\n',
    '- Vary openings across the 3 ideas.\n',
    '- Max ONE exclamation mark (!) per idea.\n',
    '- Concrete details > generic adjectives.`\n'
]

# Rebuild the file
new_lines = []
new_lines.extend(lines[:da_start])
new_lines.extend(da_prompt_lines)
new_lines.append('  }\n')
new_lines.append('\n')
new_lines.extend(en_prompt_lines)
new_lines.extend(lines[en_end+1:])

# Write the file
with open('/Users/olebaek/Test P2G 1/supabase/functions/ai-generate/index.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"✅ Replaced Danish prompt (lines {da_start}-{da_end})")
print(f"✅ Replaced English prompt (lines {en_start}-{en_end})")
print(f"✅ New file written")
