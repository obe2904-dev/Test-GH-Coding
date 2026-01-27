import React from 'react';

interface BrandProfileSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function BrandProfileSection({ 
  title, 
  icon, 
  children, 
  className = '' 
}: BrandProfileSectionProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center mb-4">
        {icon && <div className="mr-3 text-blue-600">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="text-gray-700">
        {children}
      </div>
    </div>
  );
}
