#!/usr/bin/env node
/**
 * Token Optimization Analysis
 * Identifies dead code and optimization opportunities in generate-text-from-idea
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const baseDir = '/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud/supabase/functions/generate-text-from-idea'

// Read lang-strings.ts to extract all exports
const langStrings = readFileSync(join(baseDir, 'lang-strings.ts'), 'utf-8')
const exportMatches = [...langStrings.matchAll(/export const (\w+):/g)]
const allExports = exportMatches.map(m => m[1])

console.log('═══════════════════════════════════════════════════════════════')
console.log('  Token Optimization Analysis: lang-strings.ts')
console.log('═══════════════════════════════════════════════════════════════')
console.log(`Total exports: ${allExports.length}`)
console.log()

// Check which exports are actually imported
const promptBuilders = readFileSync(join(baseDir, 'prompt-builders.ts'), 'utf-8')
const promptBuildersTyped = readFileSync(join(baseDir, 'prompt-builders-typed.ts'), 'utf-8')

const allCode = promptBuilders + '\n' + promptBuildersTyped

const used = []
const unused = []

for (const exportName of allExports) {
  // Check if it's imported
  const importRegex = new RegExp(`import.*\\b${exportName}\\b.*from ['"]./lang-strings`, 's')
  const usedRegex = new RegExp(`\\b${exportName}\\b`)
  
  if (importRegex.test(allCode) || usedRegex.test(allCode)) {
    used.push(exportName)
  } else {
    unused.push(exportName)
  }
}

console.log('✅ USED EXPORTS (' + used.length + '):')
used.forEach(name => console.log(`   ${name}`))
console.log()

console.log('❌ UNUSED EXPORTS (' + unused.length + '):')
unused.forEach(name => console.log(`   ${name}`))
console.log()

// Calculate potential savings
const unusedLines = []
for (const exportName of unused) {
  const regex = new RegExp(`export const ${exportName}:.*?(?=\\nexport|\\n$)`, 'gs')
  const match = langStrings.match(regex)
  if (match) {
    unusedLines.push({ name: exportName, lines: match[0].split('\n').length, chars: match[0].length })
  }
}

const totalUnusedChars = unusedLines.reduce((sum, item) => sum + item.chars, 0)
const totalUnusedLines = unusedLines.reduce((sum, item) => sum + item.lines, 0)

console.log('📊 POTENTIAL SAVINGS:')
console.log(`   ${totalUnusedLines} lines`)
console.log(`   ${(totalUnusedChars / 1024).toFixed(1)}KB`)
console.log(`   ${((totalUnusedChars / 54790) * 100).toFixed(1)}% of lang-strings.ts`)
console.log()

console.log('🔍 LARGEST UNUSED EXPORTS:')
unusedLines
  .sort((a, b) => b.chars - a.chars)
  .slice(0, 10)
  .forEach(item => {
    console.log(`   ${item.name}: ${item.lines} lines, ${(item.chars / 1024).toFixed(1)}KB`)
  })
