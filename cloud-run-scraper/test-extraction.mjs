import { extractOpeningHoursFromText } from './services/dom-extractor.js';

const testText1 = `MIDDLE EASTERN CUISINE Welcome to Souk! Middle Eastern feasts...
OPENING HOURS Monday - Thursday 11.30 - 23.30 11.30 - 00.00 11.30 - 00.00 11.30 - 22.30 Åboulevarden 32 8000 Aarhus C, Danmark hello@soukaarhus.dk`;

const testText2 = `OPENING HOURS Monday - Thursday 11.30 - 23.30 11.30 - 00.00 11.30 - 00.00 11.30 - 22.30`;

const testText3 = `Monday - Thursday 11.30 - 23.30`;

console.log('Test 1 - Full text with multiple lines:');
console.log(extractOpeningHoursFromText(testText1));

console.log('\nTest 2 - Just opening hours line:');
console.log(extractOpeningHoursFromText(testText2));

console.log('\nTest 3 - Clean day range + time:');
console.log(extractOpeningHoursFromText(testText3));
