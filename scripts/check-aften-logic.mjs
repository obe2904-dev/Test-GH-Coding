// Check the AFTEN menu timing and what Slot A time should be

const aftenMenu = {
  menuTitle: 'AFTEN',
  availabilityTime: '17.30-21.30',
  startTime: '17:30',
  endTime: '21:30'
};

console.log('🍽️  AFTEN Menu Facts:');
console.log(`   Period: ${aftenMenu.startTime} - ${aftenMenu.endTime}`);

const aftenStartHour = parseInt(aftenMenu.startTime.split(':')[0]);
console.log(`   Start hour: ${aftenStartHour}`);

const aftenPostTime = aftenStartHour < 18 ? '18:30' : `${aftenStartHour + 1}:00`;
console.log(`   Calculated Slot A time: ${aftenPostTime}`);
console.log(`   Logic: ${aftenStartHour} < 18 ? '18:30' : '${aftenStartHour + 1}:00'`);
