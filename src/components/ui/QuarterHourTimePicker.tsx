type QuarterHourTimePickerProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

function formatTime(hour: string, minute: string) {
  if (!hour) return ''
  return `${hour}:${minute || '00'}`
}

export function QuarterHourTimePicker({ value, onChange, className = '', disabled = false }: QuarterHourTimePickerProps) {
  const [hour = '', minute = '00'] = value ? value.split(':') : ['', '00']

  return (
    <div
      className={`inline-grid h-10 grid-cols-[1fr_auto_1fr] items-center overflow-hidden border border-border rounded-lg text-sm leading-none ${disabled ? 'bg-gray-100 opacity-60 cursor-not-allowed' : 'bg-white'} ${className}`.trim()}
    >
      <select
        value={hour}
        onChange={(event) => onChange(formatTime(event.target.value, minute))}
        disabled={disabled}
        className="appearance-none w-full min-w-0 bg-transparent px-3 py-2 outline-none text-center disabled:cursor-not-allowed"
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
        disabled={disabled}
        className="appearance-none w-full min-w-0 bg-transparent px-3 py-2 outline-none text-center disabled:cursor-not-allowed"
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