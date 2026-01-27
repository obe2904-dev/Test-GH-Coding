import React from 'react';

interface GenerationProgressProps {
  message?: string;
}

export function GenerationProgress({ message = 'Genererer brandprofil...' }: GenerationProgressProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Spinner */}
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-100 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
      </div>

      {/* Message */}
      <p className="text-lg font-medium text-gray-900 mb-2">{message}</p>
      <p className="text-sm text-gray-500">Dette tager typisk 15-25 sekunder</p>

      {/* Progress steps */}
      <div className="mt-8 w-full max-w-md">
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3 animate-pulse"></div>
            <span>Indsamler forretningsdata...</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3 animate-pulse delay-100"></div>
            <span>Analyserer menu og lokation...</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full mr-3 animate-pulse delay-200"></div>
            <span>Genererer brandidentitet med AI...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
