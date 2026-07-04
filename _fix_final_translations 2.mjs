#!/usr/bin/env node
/**
 * Final fix: Add remaining missing keys to English
 */

import fs from 'fs';

const enPath = './src/lib/locales/en.json';

console.log('🔧 Adding final missing translations to English...\n');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

// Add the two remaining Danish keys to English publish section
if (!enJson.createPost.publish.preparing) {
  enJson.createPost.publish.preparing = "Preparing...";
}

if (!enJson.createPost.publish.scheduleCta) {
  enJson.createPost.publish.scheduleCta = "Schedule";
}

// Write back
fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2) + '\n', 'utf-8');

console.log('✅ Final translations added!\n');
console.log('📝 CHANGES:');
console.log('   • Added createPost.publish.preparing to English');
console.log('   • Added createPost.publish.scheduleCta to English');

process.exit(0);
