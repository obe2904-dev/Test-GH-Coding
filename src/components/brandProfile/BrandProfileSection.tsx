import React from 'react';

interface BrandProfileSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  badge?: string;
}

export function BrandProfileSection({ 
  title, 
  icon, 
  children, 
  className = '',
  badge,
}: BrandProfileSectionProps) {
  return (
    <div className={`bg-surface rounded-lg border border-border p-6 ${className}`}>
      <div className="flex items-center mb-4">
        {icon && <div className="mr-3 text-text-muted">{icon}</div>}
        <h3 className="text-lg font-semibold text-brand">{title}</h3>
        {badge && (
          <span className="ml-auto text-xs text-success-text bg-success-surface border border-success px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="text-text">
        {children}
      </div>
    </div>
  );
}
