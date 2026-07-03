interface PlatformIndicatorProps {
  platform: string
  isConnected: boolean
}

const PLATFORM_CONFIG: Record<string, { dot: string; symbol: string }> = {
  Facebook: { dot: 'bg-[#2563EB]', symbol: 'f' },
  Instagram: { dot: 'bg-[#EC4899]', symbol: 'i' }
}

export function PlatformIndicator({ platform, isConnected }: PlatformIndicatorProps) {
  const config = PLATFORM_CONFIG[platform] ?? PLATFORM_CONFIG.Facebook

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="text-xs font-medium text-slate-700">{platform}</span>
      {isConnected ? (
        <span className="text-xs" title="Connected">
          ✓
        </span>
      ) : (
        <span className="text-xs text-amber-600" title="Not connected">
          ⚠
        </span>
      )}
    </div>
  )
}
