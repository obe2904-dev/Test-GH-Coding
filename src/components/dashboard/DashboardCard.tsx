import { TierBadge } from './TierBadge';

// Icon components
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);

const HalfCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: 'complete' | 'partial'; // Only for unlocked cards
  locked?: {
    tier: 'Smart' | 'Pro';
    prerequisite?: string;         // Short tooltip text
  };
  onClick?: () => void;
  className?: string;
}

export function DashboardCard({
  icon,
  title,
  description,
  status,
  locked,
  onClick,
  className = '',
}: DashboardCardProps) {
  const isLocked = !!locked;

  // Build classNames
  const baseClasses = 'relative rounded-xl border p-4 min-h-[110px] transition-colors';
  const lockClasses = isLocked
    ? 'bg-white border-slate-200 cursor-default opacity-70'
    : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer';
  const statusClasses = status === 'complete' ? 'border-[#0A7D5F] border-[1.5px] bg-[#f0faf6]' : '';
  const combinedClasses = `${baseClasses} ${lockClasses} ${statusClasses} ${className}`.trim();

  return (
    <div
      onClick={!isLocked ? onClick : undefined}
      className={combinedClasses}
    >
      {/* Lock icon with tooltip */}
      {isLocked && (
        <div className="absolute top-3 right-3 group">
          <LockIcon className="w-3.5 h-3.5 text-slate-400" />
          {locked.prerequisite && (
            <div className="
              absolute right-0 top-5 z-10 w-48
              bg-slate-800 border border-slate-700 rounded-lg
              px-3 py-2 text-[11px] text-slate-100 leading-snug
              shadow-md
              invisible opacity-0 group-hover:visible group-hover:opacity-100
              transition-opacity duration-150
              pointer-events-none
            ">
              {locked.prerequisite}
            </div>
          )}
        </div>
      )}

      {/* Status indicator — top-right for unlocked cards */}
      {!isLocked && status === 'complete' && (
        <CheckCircleIcon className="w-3.5 h-3.5 absolute top-3 right-3 text-[#0A7D5F]" />
      )}
      {!isLocked && status === 'partial' && (
        <HalfCircleIcon className="w-3.5 h-3.5 absolute top-3 right-3 text-amber-500" />
      )}

      {/* Card icon */}
      <div className={`mb-2 text-lg ${isLocked ? 'text-slate-400' : 'text-slate-600'}`}>
        {icon}
      </div>

      {/* Title + tier badge */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <p className={`text-[13px] font-medium ${isLocked ? 'text-slate-400' : 'text-slate-900'}`}>
          {title}
        </p>
        {locked?.tier && (
          <TierBadge tier={locked.tier} />
        )}
      </div>

      {/* Description */}
      <p className={`text-[11.5px] leading-relaxed ${isLocked ? 'text-slate-400' : 'text-slate-600'}`}>
        {description}
      </p>
    </div>
  );
}
