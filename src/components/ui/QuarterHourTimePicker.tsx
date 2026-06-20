type QuarterHourTimePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

function formatTime(hour: string, minute: string) {
  if (!hour) return ''
  return `${hour}:${minute || '00'}`
}

export function QuarterHourTimePicker({ value, onChange, className = '' }: QuarterHourTimePickerProps) {
  const [hour = '', minute = '00'] = value ? value.split(':') : ['', '00']

  return (
    <div
      className={`inline-grid h-10 grid-cols-[1fr_auto_1fr] items-center overflow-hidden border border-border rounded-lg bg-white text-sm leading-none ${className}`.trim()}
    >
      <select
        value={hour}
        onChange={(event) => onChange(formatTime(event.target.value, minute))}
        className="appearance-none w-full min-w-0 bg-transparent px-3 py-2 outline-none text-center"
        aria-label="Hour"
      >
        <option value="">--</option>
        {HOURS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="flex items-center px-0.5 text-text-muted select-none">:</span>
      <select
        value={minute}
        onChange={(event) => onChange(formatTime(hour, event.target.value))}
        className="appearance-none w-full min-w-0 bg-transparent px-3 py-2 outline-none text-center"
        aria-label="Minute"
      >
        {MINUTES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}