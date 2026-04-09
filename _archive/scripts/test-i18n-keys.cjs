#!/usr/bin/env node
const fs = require('fs');

const en = JSON.parse(fs.readFileSync('./src/lib/locales/promptI18n.en.json','utf8'));
const da = JSON.parse(fs.readFileSync('./src/lib/locales/promptI18n.da.json','utf8'));

console.log('🔍 Comparing prompt i18n keys:\n');
console.log('English keys:', Object.keys(en).sort().join(', '));
console.log('\nDanish keys:', Object.keys(da).sort().join(', '));

const enKeys = new Set(Object.keys(en));
const daKeys = new Set(Object.keys(da));

const missingInDa = [...enKeys].filter(k => !daKeys.has(k));
const missingInEn = [...daKeys].filter(k => !enKeys.has(k));

console.log('\n📊 Key coverage:');
console.log('English file:', enKeys.size, 'keys');
console.log('Danish file:', daKeys.size, 'keys');

if (missingInDa.length) console.log('❌ Missing in Danish:', missingInDa);
if (missingInEn.length) console.log('❌ Missing in English:', missingInEn);
if (!missingInDa.length && !missingInEn.length) console.log('✅ All keys match perfectly!');

console.log('\n🎯 Sample translations:');
console.log('EN systemRole:', en.systemRole.substring(0, 80) + '...');
console.log('DA systemRole:', da.systemRole.substring(0, 80) + '...');
console.log('\nEN locationGuidance:', en.locationGuidance.substring(0, 100) + '...');
console.log('DA locationGuidance:', da.locationGuidance.substring(0, 100) + '...');
