#!/usr/bin/env node
/**
 * Add missing calendar event translations from contextual_calendar database
 */

import fs from 'fs';

const enPath = './src/lib/locales/en.json';
const daPath = './src/lib/locales/da.json';

console.log('🔧 Adding missing calendar event translations...\n');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const daJson = JSON.parse(fs.readFileSync(daPath, 'utf-8'));

// Ensure calendarEvent section exists in both
if (!enJson.calendarEvent) enJson.calendarEvent = {};
if (!daJson.calendarEvent) daJson.calendarEvent = {};

// Add all missing event translations
// Public holidays
daJson.calendarEvent["Nytårsdag"] = "Nytårsdag";
enJson.calendarEvent["Nytårsdag"] = "New Year's Day";

daJson.calendarEvent["Skærtorsdag"] = "Skærtorsdag";
enJson.calendarEvent["Skærtorsdag"] = "Maundy Thursday";

daJson.calendarEvent["Langfredag"] = "Langfredag";
enJson.calendarEvent["Langfredag"] = "Good Friday";

daJson.calendarEvent["1. Påskedag"] = "1. påskedag";
enJson.calendarEvent["1. Påskedag"] = "Easter Sunday";

daJson.calendarEvent["2. Påskedag"] = "2. påskedag";
enJson.calendarEvent["2. Påskedag"] = "Easter Monday";

daJson.calendarEvent["Kristi Himmelfartsdag"] = "Kristi himmelfartsdag";
enJson.calendarEvent["Kristi Himmelfartsdag"] = "Ascension Day";

daJson.calendarEvent["2. Pinsedag"] = "2. pinsedag";
enJson.calendarEvent["2. Pinsedag"] = "Whit Monday";

daJson.calendarEvent["Grundlovsdag"] = "Grundlovsdag";
enJson.calendarEvent["Grundlovsdag"] = "Constitution Day";

daJson.calendarEvent["Juleaftensdag"] = "Juleaftensdag";
enJson.calendarEvent["Juleaftensdag"] = "Christmas Eve";

daJson.calendarEvent["1. Juledag"] = "1. juledag";
enJson.calendarEvent["1. Juledag"] = "Christmas Day";

daJson.calendarEvent["2. Juledag"] = "2. juledag";
enJson.calendarEvent["2. Juledag"] = "Boxing Day";

// School vacations
daJson.calendarEvent["Vinterferie"] = "Vinterferie";
enJson.calendarEvent["Vinterferie"] = "Winter break";

daJson.calendarEvent["Påskeferie"] = "Påskeferie";
enJson.calendarEvent["Påskeferie"] = "Easter break";

daJson.calendarEvent["Sommerferie"] = "Sommerferie";
enJson.calendarEvent["Sommerferie"] = "Summer vacation";

daJson.calendarEvent["Efterårsferie (Uge 42)"] = "Efterårsferie (uge 42)";
enJson.calendarEvent["Efterårsferie (Uge 42)"] = "Fall break (week 42)";

daJson.calendarEvent["Juleferie"] = "Juleferie";
enJson.calendarEvent["Juleferie"] = "Christmas vacation";

// Cultural events
daJson.calendarEvent["Valentinsdag"] = "Valentinsdag";
enJson.calendarEvent["Valentinsdag"] = "Valentine's Day";

daJson.calendarEvent["Fastelavn"] = "Fastelavn";
enJson.calendarEvent["Fastelavn"] = "Fastelavn (Carnival)";

daJson.calendarEvent["Mors Dag"] = "Mors dag";
enJson.calendarEvent["Mors Dag"] = "Mother's Day";

daJson.calendarEvent["Fars Dag"] = "Fars dag";
enJson.calendarEvent["Fars Dag"] = "Father's Day";

daJson.calendarEvent["Sankt Hans Aften"] = "Sankt Hans aften";
enJson.calendarEvent["Sankt Hans Aften"] = "Midsummer Eve";

daJson.calendarEvent["Black Friday"] = "Black Friday";
enJson.calendarEvent["Black Friday"] = "Black Friday";

// Write back
fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2) + '\n', 'utf-8');
fs.writeFileSync(daPath, JSON.stringify(daJson, null, 2) + '\n', 'utf-8');

console.log('✅ Calendar event translations added!\n');
console.log('📝 ADDED:');
console.log('   • 11 public holidays');
console.log('   • 5 school vacation periods');
console.log('   • 6 cultural events');
console.log('   Total: 22 new calendar event translations');

process.exit(0);
