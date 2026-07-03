import React from 'react';

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

interface AIGenerationLoadingProps {
  currentIdeaTitle: string;
  currentIdeaIndex: number;
  totalIdeas: number;
  progress: number; // 0-100
  steps: GenerationStep[];
}

// Loader spinner SVG component
const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

export const AIGenerationLoading: React.FC<AIGenerationLoadingProps> = ({
  currentIdeaTitle,
  currentIdeaIndex,
  totalIdeas,
  progress,
  steps,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <h3 className="text-lg font-semibold">
            🤖 AI genererer dit opslag...
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          Idé {currentIdeaIndex} af {totalIdeas}: "{currentIdeaTitle}"
        </p>
      </div>

      {/* Progress Steps */}
      <div className="w-full max-w-md space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              {step.status === 'complete' && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {step.status === 'active' && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              {step.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
            </div>

            {/* Label */}
            <span
              className={`text-sm flex-1 ${
                step.status === 'active'
                  ? 'text-blue-600 font-medium'
                  : step.status === 'complete'
                  ? 'text-gray-700'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Fremskridt</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Estimated Time */}
      <p className="text-xs text-gray-500">
        Estimeret tid: {Math.ceil((100 - progress) / 20)} sekunder
      </p>
    </div>
  );
};
