interface AiSourceBadgeProps {
  status: 'found' | 'partial' | 'notfound'
}

export function AiSourceBadge({ status }: AiSourceBadgeProps) {
  const config = {
    found: {
      icon: '🟢',
      text: 'Fundet automatisk',
      color: 'text-green-700',
      bg: 'bg-green-50'
    },
    partial: {
      icon: '🟡',
      text: 'Delvist fundet',
      color: 'text-amber-700',
      bg: 'bg-amber-50'
    },
    notfound: {
      icon: '⚪',
      text: 'Ikke fundet',
      color: 'text-gray-600',
      bg: 'bg-gray-50'
    }
  }

  const { icon, text, color, bg } = config[status]

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color} ${bg}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  )
}
