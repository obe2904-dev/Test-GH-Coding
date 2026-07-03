import type { DayOfWeek, OpeningHours, DayHours } from '@/types';
import { QuarterHourTimePicker } from '../ui/QuarterHourTimePicker';

interface OpeningHoursEditorProps {
  openingHours: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}

const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday', 
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mandag',
  tuesday: 'Tirsdag',
  wednesday: 'Onsdag',
  thursday: 'Torsdag',
  friday: 'Fredag',
  saturday: 'Lørdag',
  sunday: 'Søndag'
};

export function OpeningHoursEditor({ openingHours, onChange }: OpeningHoursEditorProps) {
  const handleDayChange = (day: DayOfWeek, field: keyof DayHours, value: string | boolean) => {
    const currentDay = openingHours[day] || { open: '08:00', close: '22:00', closed: false };
    
    onChange({
      ...openingHours,
      [day]: {
        ...currentDay,
        [field]: value
      }
    });
  };

  const handleClosedToggle = (day: DayOfWeek, closed: boolean) => {
    handleDayChange(day, 'closed', closed);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Åbningstider</h3>
      
      {DAYS.map(day => {
        const dayHours = openingHours[day] || { open: '08:00', close: '22:00', closed: false };
        
        return (
          <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            {/* Day name */}
            <div className="w-24 font-medium text-gray-700">
              {DAY_LABELS[day]}
            </div>

            {/* Closed checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dayHours.closed}
                onChange={(e) => handleClosedToggle(day, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Lukket</span>
            </label>

            {/* Time inputs (only if not closed) */}
            {!dayHours.closed && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Åbner:</label>
                  <QuarterHourTimePicker className="w-32" value={dayHours.open} onChange={(value) => handleDayChange(day, 'open', value)} />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Lukker:</label>
                  <QuarterHourTimePicker className="w-32" value={dayHours.close} onChange={(value) => handleDayChange(day, 'close', value)} />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
