import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// Post Length Guidelines Component
// Displays and allows editing of post length targets by content type
// ═══════════════════════════════════════════════════════════════════════════

interface PostLengthGuideline {
  [key: string]: string;
  content_type: string;
  sentences: string;
  characters: string;
  structure: string;
  rationale: string;
}

interface PostLengthGuidelinesProps {
  guidelines: PostLengthGuideline[];
  businessId: string;
  onUpdate?: (guidelines: PostLengthGuideline[]) => void;
  editable?: boolean;
}

const DEFAULT_GUIDELINES: PostLengthGuideline[] = [
  {
    content_type: 'Tilbud & retter',
    sentences: '3-4 sætninger',
    characters: '200-280 tegn',
    structure: 'Rettenavn + sensorisk detalje + ingrediens/teknik + CTA',
    rationale: 'Gæsten har brug for nok information til at beslutte at bestille'
  },
  {
    content_type: 'Stemning & atmosfære',
    sentences: '1-2 sætninger',
    characters: '80-140 tegn',
    structure: 'Lokation/tidspunkt + sensorisk observation + invitation',
    rationale: 'Billedet bærer budskabet, teksten forankrer konteksten'
  },
  {
    content_type: 'Øjeblikke & scener',
    sentences: '2-3 sætninger',
    characters: '140-200 tegn',
    structure: 'Scene setup + gæstehandling + resultat/følelse',
    rationale: 'Menneskelig historie kræver narrativ bue'
  },
  {
    content_type: 'Behind-the-scenes',
    sentences: '3-4 sætninger',
    characters: '180-250 tegn',
    structure: 'Procestrin + hvorfor det betyder noget + håndværksdetalje + resultat',
    rationale: 'Håndværkshistorie opbygger troværdighed gennem detaljer'
  },
  {
    content_type: 'Events & annonceringer',
    sentences: '2-3 sætninger',
    characters: '150-220 tegn',
    structure: 'Hvad + hvornår + hvorfor specielt + bookinginfo',
    rationale: 'Klar logistik er essentiel for konvertering'
  }
];

export default function PostLengthGuidelines({
  guidelines = DEFAULT_GUIDELINES,
  businessId: _businessId,
  onUpdate,
  editable = true
}: PostLengthGuidelinesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedGuidelines, setEditedGuidelines] = useState<PostLengthGuideline[]>(guidelines);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (index: number, field: keyof PostLengthGuideline, value: string) => {
    const updated = [...editedGuidelines];
    updated[index] = { ...updated[index], [field]: value };
    setEditedGuidelines(updated);
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    
    setIsSaving(true);
    try {
      await onUpdate(editedGuidelines);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save guidelines:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedGuidelines(guidelines);
    setIsEditing(false);
  };

  const handleReset = () => {
    setEditedGuidelines(DEFAULT_GUIDELINES);
  };

  const displayGuidelines = isEditing ? editedGuidelines : guidelines;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Tekstlængde-retningslinjer</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Anbefalede længder baseret på indholdstype — tilpas efter behov
          </p>
        </div>
        {editable && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs font-medium text-info hover:text-info-hover transition-colors"
          >
            Rediger
          </button>
        )}
      </div>

      {/* Guidelines Grid */}
      <div className="space-y-3">
        {displayGuidelines.map((guideline, index) => (
          <div
            key={index}
            className="p-4 bg-surface rounded-lg border border-border"
          >
            {/* Content Type Header */}
            <div className="flex items-start justify-between mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={guideline.content_type}
                  onChange={(e) => handleEdit(index, 'content_type', e.target.value)}
                  className="flex-1 text-sm font-semibold text-text bg-transparent border-b border-border focus:border-info focus:outline-none"
                />
              ) : (
                <p className="text-sm font-semibold text-text">{guideline.content_type}</p>
              )}
              
              <div className="flex items-center gap-2 ml-3">
                {isEditing ? (
                  <input
                    type="text"
                    value={guideline.sentences}
                    onChange={(e) => handleEdit(index, 'sentences', e.target.value)}
                    className="w-28 text-xs text-text-secondary bg-transparent border-b border-border focus:border-info focus:outline-none text-right"
                    placeholder="2-3 sætninger"
                  />
                ) : (
                  <span className="text-xs text-text-secondary">{guideline.sentences}</span>
                )}
              </div>
            </div>

            {/* Character Count */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-text-secondary">Tegn:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={guideline.characters}
                  onChange={(e) => handleEdit(index, 'characters', e.target.value)}
                  className="flex-1 text-xs text-text bg-transparent border-b border-border focus:border-info focus:outline-none"
                  placeholder="150-220 tegn"
                />
              ) : (
                <span className="text-xs font-medium text-text">{guideline.characters}</span>
              )}
            </div>

            {/* Structure */}
            <div className="mb-2">
              <span className="text-xs text-text-secondary block mb-1">Struktur:</span>
              {isEditing ? (
                <textarea
                  value={guideline.structure}
                  onChange={(e) => handleEdit(index, 'structure', e.target.value)}
                  rows={2}
                  className="w-full text-xs text-text bg-surface-alt rounded p-2 border border-border focus:border-info focus:outline-none resize-none"
                />
              ) : (
                <p className="text-xs text-text leading-relaxed bg-surface-alt rounded px-2 py-1.5">
                  {guideline.structure}
                </p>
              )}
            </div>

            {/* Rationale */}
            <div>
              <span className="text-xs text-text-secondary block mb-1">Hvorfor:</span>
              {isEditing ? (
                <textarea
                  value={guideline.rationale}
                  onChange={(e) => handleEdit(index, 'rationale', e.target.value)}
                  rows={2}
                  className="w-full text-xs text-text-secondary bg-transparent border border-border rounded p-2 focus:border-info focus:outline-none resize-none"
                />
              ) : (
                <p className="text-xs text-text-secondary leading-relaxed italic">
                  {guideline.rationale}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Actions */}
      {isEditing && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            onClick={handleReset}
            className="text-xs text-text-secondary hover:text-text transition-colors"
          >
            Nulstil til standard
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text transition-colors disabled:opacity-50"
            >
              Annuller
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 text-xs font-medium bg-info text-white rounded hover:bg-info-hover transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Gemmer...' : 'Gem ændringer'}
            </button>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-4 p-3 bg-info-surface border-l-4 border-info rounded">
        <p className="text-xs text-info leading-relaxed">
          💡 <strong>Tip:</strong> Længere tekster fungerer bedst til tilbud og events hvor information er kritisk. 
          Kortere tekster fungerer bedst til stemningsbilleder hvor foto'et bærer budskabet.
        </p>
      </div>
    </div>
  );
}
