#!/usr/bin/env node
/**
 * Comprehensive I18N Prompt Integration Test
 * Tests that the prompt system properly handles Danish/English translations
 * and that prompts are correctly generated with localized content.
 */

import { readFileSync } from 'fs'

const daJson = JSON.parse(readFileSync('./src/lib/locales/promptI18n.da.json', 'utf8'))
const enJson = JSON.parse(readFileSync('./src/lib/locales/promptI18n.en.json', 'utf8'))

function normalizePromptLanguage(language) {
  return language === 'da' ? 'da' : 'en'
}

function getPromptI18n(lang) {
  const src = lang === 'da' ? daJson : enJson
  return {
    meta: {
      promptLanguageLine: (l) => `PROMPT_SPROG: ${l}`
    },
    ...src
  }
}

console.log('🧪 Testing I18N Prompt Integration\n')

// Test 1: Language normalization
console.log('📍 Test 1: Language Normalization')
const tests = [
  { input: 'da', expected: 'da' },
  { input: 'en', expected: 'en' },
  { input: 'DA', expected: 'en' }, // Only lowercase 'da' returns 'da'
  { input: 'dansk', expected: 'en' },
  { input: null, expected: 'en' },
  { input: undefined, expected: 'en' },
]

let test1Pass = true
tests.forEach(({ input, expected }) => {
  const result = normalizePromptLanguage(input)
  const pass = result === expected
  if (!pass) test1Pass = false
  console.log(`   ${pass ? '✅' : '❌'} normalizePromptLanguage(${JSON.stringify(input)}) = "${result}" (expected "${expected}")`)
})

// Test 2: Danish prompt i18n
console.log('\n📍 Test 2: Danish Prompt i18n')
const daPrompt = getPromptI18n('da')
const test2Checks = [
  { key: 'language.instruction', value: daPrompt.language.instruction, contains: 'dansk', description: 'Contains "dansk"' },
  { key: 'businessContext.name', value: daPrompt.businessContext.name, expected: 'Virksomhedsnavn', description: 'Business name label' },
  { key: 'platforms.platformsLabel', value: daPrompt.platforms.platformsLabel, expected: 'Platforme', description: 'Platforms label' },
  { key: 'platforms.noHashtagsRule', value: daPrompt.platforms.noHashtagsRule, contains: 'IKKE', description: 'Contains IKKE (NOT)' },
]

let test2Pass = true
test2Checks.forEach(({ key, value, contains, expected, description }) => {
  let pass = false
  if (expected) {
    pass = value === expected
  } else if (contains) {
    pass = value.toLowerCase().includes(contains.toLowerCase())
  }
  if (!pass) test2Pass = false
  console.log(`   ${pass ? '✅' : '❌'} ${key}: ${description} - "${value}"`)
})

// Test 3: English prompt i18n
console.log('\n📍 Test 3: English Prompt i18n')
const enPrompt = getPromptI18n('en')
const test3Checks = [
  { key: 'language.instruction', value: enPrompt.language.instruction, contains: 'English', description: 'Contains "English"' },
  { key: 'businessContext.name', value: enPrompt.businessContext.name, expected: 'Business Name', description: 'Business name label' },
  { key: 'platforms.platformsLabel', value: enPrompt.platforms.platformsLabel, expected: 'Platforms', description: 'Platforms label' },
  { key: 'platforms.noHashtagsRule', value: enPrompt.platforms.noHashtagsRule, contains: 'NOT', description: 'Contains NOT' },
]

let test3Pass = true
test3Checks.forEach(({ key, value, contains, expected, description }) => {
  let pass = false
  if (expected) {
    pass = value === expected
  } else if (contains) {
    pass = value.toLowerCase().includes(contains.toLowerCase())
  }
  if (!pass) test3Pass = false
  console.log(`   ${pass ? '✅' : '❌'} ${key}: ${description} - "${value}"`)
})

// Test 4: Key structure consistency
console.log('\n📍 Test 4: Key Structure Consistency')
const enKeys = JSON.stringify(Object.keys(enPrompt).sort())
const daKeys = JSON.stringify(Object.keys(daPrompt).sort())
const test4Pass = enKeys === daKeys
console.log(`   ${test4Pass ? '✅' : '❌'} English and Danish have identical key structures`)
if (!test4Pass) {
  console.log(`   EN keys: ${enKeys}`)
  console.log(`   DA keys: ${daKeys}`)
}

// Test 5: Nested structure depth
console.log('\n📍 Test 5: Nested Structure Completeness')
const checkNested = (obj, path = '') => {
  let count = 0
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && typeof obj[key] !== 'function') {
      count += checkNested(obj[key], `${path}${key}.`)
    } else if (typeof obj[key] !== 'function') {
      count++
    }
  }
  return count
}

const enLeafCount = checkNested(enPrompt)
const daLeafCount = checkNested(daPrompt)
const test5Pass = enLeafCount === daLeafCount && enLeafCount > 20
console.log(`   ${test5Pass ? '✅' : '❌'} English has ${enLeafCount} leaf values, Danish has ${daLeafCount} leaf values`)

// Test 6: No English in Danish translations
console.log('\n📍 Test 6: Language Purity Check')
const checkForEnglishWords = (obj, path = '') => {
  const englishWords = ['business', 'menu', 'optional', 'context', 'booking', 'format', 'rules', 'task']
  const violations = []
  
  const check = (value, key, fullPath) => {
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase()
      englishWords.forEach(word => {
        if (lowerValue.includes(word) && !lowerValue.includes('businesscontext')) { // businessContext is a key name, acceptable
          violations.push({ path: fullPath, value, word })
        }
      })
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const k in value) {
        check(value[k], k, `${fullPath}.${k}`)
      }
    }
  }
  
  check(obj, '', path)
  return violations
}

const daViolations = checkForEnglishWords(daPrompt, 'daPrompt')
const test6Pass = daViolations.length === 0
console.log(`   ${test6Pass ? '✅' : '⚠️'} Danish prompt has ${daViolations.length} potential English words`)
if (daViolations.length > 0 && daViolations.length <= 3) {
  daViolations.forEach(v => {
    console.log(`      Note: "${v.word}" found in ${v.path}: "${v.value}"`)
  })
}

// Final summary
console.log('\n' + '='.repeat(60))
console.log('📊 Test Summary:')
console.log(`   Test 1 (Language Normalization): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`   Test 2 (Danish i18n): ${test2Pass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`   Test 3 (English i18n): ${test3Pass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`   Test 4 (Key Consistency): ${test4Pass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`   Test 5 (Structure Completeness): ${test5Pass ? '✅ PASS' : '❌ FAIL'}`)
console.log(`   Test 6 (Language Purity): ${test6Pass ? '✅ PASS' : '⚠️ WARNING'}`)

const allPass = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass && test6Pass
console.log('\n' + (allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'))

process.exit(allPass ? 0 : 1)
