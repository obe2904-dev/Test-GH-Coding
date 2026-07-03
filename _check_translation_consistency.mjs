#!/usr/bin/env node
/**
 * Check consistency between English and Danish translation files
 */

import fs from 'fs';

const enPath = './src/lib/locales/en.json';
const daPath = './src/lib/locales/da.json';

console.log('🔍 Checking translation consistency...\n');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const daJson = JSON.parse(fs.readFileSync(daPath, 'utf-8'));

/**
 * Recursively get all keys from a nested object
 * Returns array of [path_array, value] tuples to avoid issues with dots in keys
 */
function getAllKeys(obj, prefix = []) {
  const keys = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = [...prefix, key];
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullPath));
    } else {
      keys.push({ path: fullPath, value });
    }
  }
  
  return keys;
}

/**
 * Get value at path array
 */
function getValueAtPath(obj, pathArray) {
  let current = obj;
  for (const key of pathArray) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

const enKeys = getAllKeys(enJson);
const daKeys = getAllKeys(daJson);

// Create sets for comparison using stringified paths
const enSet = new Set(enKeys.map(k => JSON.stringify(k.path)));
const daSet = new Set(daKeys.map(k => JSON.stringify(k.path)));

// Find missing translations
const missingInEnglish = daKeys.filter(k => !enSet.has(JSON.stringify(k.path)));
const missingInDanish = enKeys.filter(k => !daSet.has(JSON.stringify(k.path)));

// Find empty values
const emptyInEnglish = enKeys.filter(k => {
  const value = k.value;
  return value === '' || value === null || value === undefined;
});

const emptyInDanish = daKeys.filter(k => {
  const value = k.value;
  return value === '' || value === null || value === undefined;
});

// Report results
console.log('📊 STATISTICS:');
console.log(`   EN keys: ${enKeys.length}`);
console.log(`   DA keys: ${daKeys.length}`);
console.log(`   Difference: ${Math.abs(enKeys.length - daKeys.length)} keys\n`);

if (missingInDanish.length > 0) {
  console.log('❌ MISSING IN DANISH (keys in EN but not in DA):');
  missingInDanish.forEach(k => {
    const pathStr = k.path.join('.');
    console.log(`   ${pathStr}: "${k.value}"`);
  });
  console.log('');
}

if (missingInEnglish.length > 0) {
  console.log('❌ MISSING IN ENGLISH (keys in DA but not in EN):');
  missingInEnglish.forEach(k => {
    const pathStr = k.path.join('.');
    console.log(`   ${pathStr}: "${k.value}"`);
  });
  console.log('');
}

if (emptyInEnglish.length > 0) {
  console.log('⚠️  EMPTY VALUES IN ENGLISH:');
  emptyInEnglish.forEach(k => {
    const pathStr = k.path.join('.');
    console.log(`   ${pathStr}`);
  });
  console.log('');
}

if (emptyInDanish.length > 0) {
  console.log('⚠️  EMPTY VALUES IN DANISH:');
  emptyInDanish.forEach(k => {
    const pathStr = k.path.join('.');
    console.log(`   ${pathStr}`);
  });
  console.log('');
}

// Summary
const totalIssues = missingInDanish.length + missingInEnglish.length + 
                    emptyInEnglish.length + emptyInDanish.length;

if (totalIssues === 0) {
  console.log('✅ All translations are consistent!');
} else {
  console.log(`\n🔧 SUMMARY: ${totalIssues} issues found`);
  console.log(`   Missing in DA: ${missingInDanish.length}`);
  console.log(`   Missing in EN: ${missingInEnglish.length}`);
  console.log(`   Empty in EN: ${emptyInEnglish.length}`);
  console.log(`   Empty in DA: ${emptyInDanish.length}`);
}

process.exit(totalIssues > 0 ? 1 : 0);
