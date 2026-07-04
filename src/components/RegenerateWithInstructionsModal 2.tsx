import React, { useState } from 'react';

// Icon components as inline SVGs
const X = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

interface RegenerateWithInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (instructions?: string) => void;
  currentText: string;
}

export const RegenerateWithInstructionsModal: React.FC<RegenerateWithInstructionsModalProps> = ({
  isOpen,
  onClose,
  onRegenerate,
  currentText,
}) => {
  const [instructions, setInstructions] = useState('');
  const [selectedOption, setSelectedOption] = useState<'clean' | 'with-instructions'>('clean');

  if (!isOpen) return null;

  const handleRegenerate = () => {
    if (selectedOption === 'with-instructions' && instructions.trim()) {
      onRegenerate(instructions.trim());
    } else {
      onRegenerate();
    }
    onClose();
    setInstructions('');
    setSelectedOption('clean');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Regenerer tekst</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Current Text Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Nuværende tekst:
            </label>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 max-h-32 overflow-y-auto">
              {currentText}
            </div>
          </div>

          {/* Regeneration Options */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700 block">
              Vælg regenereringsmulighed:
            </label>

            {/* Option 1: Clean Regenerate */}
            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              style={{
                borderColor: selectedOption === 'clean' ? '#3B82F6' : '#E5E7EB'
              }}
            >
              <input
                type="radio"
                name="regenerate-option"
                value="clean"
                checked={selectedOption === 'clean'}
                onChange={() => setSelectedOption('clean')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">
                    Regenerer fra bunden
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  AI skriver en helt ny tekst baseret på den originale strategiske idé
                </p>
              </div>
            </label>

            {/* Option 2: With Instructions */}
            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              style={{
                borderColor: selectedOption === 'with-instructions' ? '#3B82F6' : '#E5E7EB'
              }}
            >
              <input
                type="radio"
                name="regenerate-option"
                value="with-instructions"
                checked={selectedOption === 'with-instructions'}
                onChange={() => setSelectedOption('with-instructions')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">
                    Regenerer med instrukser
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Tilføj specifikke ønsker til hvordan AI skal skrive teksten
                </p>
              </div>
            </label>

            {/* Instructions Textarea (shown when 'with-instructions' is selected) */}
            {selectedOption === 'with-instructions' && (
              <div className="ml-7 space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  Dine instrukser til AI:
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Fx: 'Gør teksten mere sjov og legende' eller 'Fokuser mere på smagen' eller 'Tilføj et spørgsmål i slutningen'"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500">
                  💡 Tip: Vær specifik om hvad du vil have ændret eller fremhævet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={handleRegenerate}
            disabled={selectedOption === 'with-instructions' && !instructions.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerer
          </button>
        </div>
      </div>
    </div>
  );
};
