// Icon components
const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

interface ContentCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  payoff: string;           // One-line "what do I get" — shown below divider
  isHero?: boolean;         // true = AI-driven teal card with badge
  locked?: {
    tier: 'Smart' | 'Pro';
    prerequisite?: string;
  };
  onClick?: () => void;
}

export function ContentCard({
  icon,
  title,
  description,
  payoff,
  isHero = false,
  locked,
  onClick,
}: ContentCardProps) {
  const isLocked = !!locked;

  // Build classes
  const baseClasses = 'relative rounded-xl flex flex-col min-h-[130px] p-4 transition-colors';
  
  let bgAndBorderClasses = '';
  if (isLocked) {
    bgAndBorderClasses = 'bg-white border border-[0.5px] border-slate-200 cursor-default';
  } else if (isHero) {
    bgAndBorderClasses = 'bg-[#f0faf6] border border-[#9FE1CB] hover:border-[#0A7D5F] cursor-pointer';
  } else {
    bgAndBorderClasses = 'bg-white border border-[0.5px] border-slate-200 hover:border-slate-300 cursor-pointer';
  }

  const iconClasses = isLocked 
    ? 'text-slate-400'
    : isHero
      ? 'text-[#0A7D5F]'
      : 'text-slate-600';

  const titleClasses = isLocked ? 'text-slate-400' : 'text-slate-900';
  const descriptionClasses = isLocked ? 'text-slate-400' : 'text-slate-600';
  
  const dividerClasses = isLocked || !isHero
    ? 'border-slate-200'
    : 'border-[#9FE1CB]';
    
  const payoffClasses = isLocked || !isHero
    ? 'text-slate-500'
    : 'text-[#0F6E56]';

  return (
    <div
      onClick={!isLocked ? onClick : undefined}
      className={`${baseClasses} ${bgAndBorderClasses}`}
    >
      {/* AI badge — hero unlocked only */}
      {isHero && !isLocked && (
        <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[9.5px] font-medium bg-[#e6f5f0] text-[#0A7D5F] px-1.5 py-0.5 rounded-full">
          <SparklesIcon className="w-2.5 h-2.5" />
          AI
        </span>
      )}

      {/* Lock icon — locked cards only */}
      {isLocked && (
        <div className="absolute top-2.5 right-2.5 group">
          <LockIcon className="w-3.5 h-3.5 text-slate-400" />
          {locked.prerequisite && (
            <div className="
              absolute right-0 top-5 z-10 w-48
              bg-slate-800 border border-slate-700 rounded-lg
              px-3 py-2 text-[11px] text-slate-100 leading-snug shadow-md
              invisible opacity-0 group-hover:visible group-hover:opacity-100
              transition-opacity duration-150 pointer-events-none
            ">
              {locked.prerequisite}
            </div>
          )}
        </div>
      )}

      {/* Icon */}
      <div className={`text-[17px] mb-1.5 ${iconClasses}`}>
        {icon}
      </div>

      {/* Title */}
      <p className={`text-[13px] font-medium mb-1 ${titleClasses}`}>
        {title}
      </p>

      {/* Description */}
      <p className={`text-[11.5px] leading-relaxed flex-1 mb-2 ${descriptionClasses}`}>
        {description}
      </p>

      {/* Payoff line */}
      <div className={`flex items-start gap-1 text-[10.5px] leading-snug pt-1.5 mt-auto border-t ${dividerClasses} ${payoffClasses}`}>
        <span className="mt-[1px]">→</span>
        {payoff}
      </div>
    </div>
  );
}
