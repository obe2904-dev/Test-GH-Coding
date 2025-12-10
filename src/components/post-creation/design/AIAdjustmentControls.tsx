import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhotoAdjustments } from '../../../stores/postCreationStore'

// Icon Components
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
  </svg>
)

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23,4 23,10 17,10"/>
    <polyline points="1,20 1,14 7,14"/>
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4a9 9 0 0 1-14.85 3.36L23 14"/>
  </svg>
)

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6,9 12,15 18,9"/>
  </svg>
)

const Crop = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
  </svg>
)

const Eraser = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M20 20h-8.5L8 16.5 2.5 11 8 5.5 16.5 14H20z"/>
    <path d="M16.5 14L20 17.5"/>
  </svg>
)

const Palette = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="13.5" cy="6.5" r=".5"/>
    <circle cx="17.5" cy="10.5" r=".5"/>
    <circle cx="8.5" cy="7.5" r=".5"/>
    <circle cx="6.5" cy="12.5" r=".5"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
)

interface AIAdjustmentControlsProps {
  hasAdjustedVersion: boolean
  isProcessing: boolean
  adjustments: PhotoAdjustments
  onAutoEnhance: () => void
  onResetAdjustments: () => void
  onApplyAdjustment: (category: 'cropAndSize' | 'cleaning' | 'colorGrading') => void
  onUpdateAdjustments: (adjustments: PhotoAdjustments) => void
}

export function AIAdjustmentControls({
  hasAdjustedVersion,
  isProcessing,
  adjustments,
  onAutoEnhance,
  onResetAdjustments,
  onApplyAdjustment,
  onUpdateAdjustments
}: AIAdjustmentControlsProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const [showManualControls, setShowManualControls] = useState(false)

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          {t('create.aiAdjustments', 'AI Photo Enhancement')}
        </h3>
        {hasAdjustedVersion && (
          <button
            onClick={onResetAdjustments}
            className="text-xs text-slate-600 hover:text-red-600 font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            {t('create.reset', 'Reset')}
          </button>
        )}
      </div>

      {/* AUTO MODE - Just Do It Button */}
      <button
        onClick={onAutoEnhance}
        disabled={isProcessing}
        className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-sm flex items-center justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
      >
        <Zap className="w-4 h-4" />
        {t('create.autoEnhance', 'Auto Enhance Photo')}
      </button>

      {/* Expandable Manual Controls */}
      <button
        onClick={() => setShowManualControls(!showManualControls)}
        className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all font-medium text-xs flex items-center justify-between"
      >
        <span>{t('create.manualControls', 'Manual Controls (Advanced)')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showManualControls ? 'rotate-180' : ''}`} />
      </button>

      {/* Manual Controls - Collapsible */}
      {showManualControls && (
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          
          {/* Category 1: Crop & Size */}
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Crop className="w-4 h-4 text-indigo-600" />
                {t('create.cropAndSize', 'Crop & Size')}
              </h4>
            </div>
            
            <p className="text-xs text-slate-600 mb-2">
              {t('create.cropDescription', 'Optimize for social media platforms')}
            </p>
            
            {/* Platform Selection */}
            <div className="mb-2">
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                {t('create.optimizeFor', 'Optimize for')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateAdjustments({
                    ...adjustments,
                    cropAndSize: { ...adjustments.cropAndSize, platform: 'facebook' }
                  })}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                    adjustments.cropAndSize.platform === 'facebook'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Facebook
                </button>
                <button
                  onClick={() => onUpdateAdjustments({
                    ...adjustments,
                    cropAndSize: { ...adjustments.cropAndSize, platform: 'instagram' }
                  })}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                    adjustments.cropAndSize.platform === 'instagram'
                      ? 'bg-pink-100 text-pink-700 border border-pink-300'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Instagram
                </button>
                <button
                  onClick={() => onUpdateAdjustments({
                    ...adjustments,
                    cropAndSize: { ...adjustments.cropAndSize, platform: 'both' }
                  })}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                    adjustments.cropAndSize.platform === 'both'
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Both
                </button>
              </div>
            </div>
            
            {/* Focus Mode */}
            <div className="mb-3">
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                {t('create.focusOn', 'Focus on')}
              </label>
              <select 
                value={adjustments.cropAndSize.focusMode}
                onChange={(e) => onUpdateAdjustments({
                  ...adjustments,
                  cropAndSize: { ...adjustments.cropAndSize, focusMode: e.target.value as any }
                })}
                className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
              >
                <option value="auto">{t('create.autoDetect', 'Auto-detect main subject')}</option>
                <option value="center">{t('create.center', 'Center')}</option>
                <option value="face">{t('create.faceDetection', 'Face detection')}</option>
                <option value="product">{t('create.productFocus', 'Product focus')}</option>
              </select>
            </div>
            
            <button
              onClick={() => onApplyAdjustment('cropAndSize')}
              disabled={isProcessing}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('create.applyCrop', 'Apply Smart Crop')}
            </button>
          </div>

          {/* Category 2: Cleaning (Most Important) */}
          <div className="border-2 border-indigo-200 rounded-lg p-3 bg-indigo-50/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Eraser className="w-4 h-4 text-indigo-600" />
                {t('create.cleaning', 'Photo Cleaning')}
              </h4>
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                {t('create.recommended', 'TOP')}
              </span>
            </div>
            
            <p className="text-xs text-slate-600 mb-3">
              💡 {t('create.cleaningTip', 'Subtle removal only - keeps natural look')}
            </p>
            
            {/* Cleaning Options */}
            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={adjustments.cleaning.removeBackground}
                  onChange={(e) => onUpdateAdjustments({
                    ...adjustments,
                    cleaning: { ...adjustments.cleaning, removeBackground: e.target.checked }
                  })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  {t('create.removeBackground', 'Remove background distractions')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={adjustments.cleaning.removeObjects}
                  onChange={(e) => onUpdateAdjustments({
                    ...adjustments,
                    cleaning: { ...adjustments.cleaning, removeObjects: e.target.checked }
                  })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  {t('create.removeObjects', 'Remove unwanted objects')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={adjustments.cleaning.reduceBlemishes}
                  onChange={(e) => onUpdateAdjustments({
                    ...adjustments,
                    cleaning: { ...adjustments.cleaning, reduceBlemishes: e.target.checked }
                  })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  {t('create.reduceBlemishes', 'Minor blemish reduction')}
                </span>
              </label>
            </div>
            
            {/* Intensity Slider */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-700">
                  {t('create.intensity', 'Cleaning Intensity')}
                </label>
                <span className="text-xs text-slate-600">
                  {adjustments.cleaning.intensity < 40 ? 'Subtle' : 
                   adjustments.cleaning.intensity < 70 ? 'Moderate' : 'Strong'}
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={adjustments.cleaning.intensity}
                onChange={(e) => onUpdateAdjustments({
                  ...adjustments,
                  cleaning: { ...adjustments.cleaning, intensity: parseInt(e.target.value) }
                })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Natural</span>
                <span>Moderate</span>
                <span>Strong</span>
              </div>
            </div>
            
            <button
              onClick={() => onApplyAdjustment('cleaning')}
              disabled={isProcessing}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('create.applyCleaning', 'Apply Smart Cleaning')}
            </button>
          </div>

          {/* Category 3: Color & Grading */}
          <div className="border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                {t('create.colorGrading', 'Color & Grading')}
              </h4>
            </div>
            
            {/* Temperature Slider */}
            <div className="mb-3">
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                {t('create.temperature', 'Temperature')}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 whitespace-nowrap">❄️ Cool</span>
                <input 
                  type="range" 
                  min="-50" 
                  max="50" 
                  value={adjustments.colorGrading.temperature}
                  onChange={(e) => onUpdateAdjustments({
                    ...adjustments,
                    colorGrading: { ...adjustments.colorGrading, temperature: parseInt(e.target.value), preset: 'custom' }
                  })}
                  className="flex-1 h-2 bg-gradient-to-r from-blue-200 via-slate-200 to-orange-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-orange-600 whitespace-nowrap">🔥 Warm</span>
              </div>
            </div>
            
            {/* Quick Presets */}
            <div className="mb-3">
              <label className="text-xs font-medium text-slate-700 mb-1 block">
                {t('create.presets', 'Quick Presets')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['natural', 'vibrant', 'muted', 'custom'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onUpdateAdjustments({
                      ...adjustments,
                      colorGrading: { ...adjustments.colorGrading, preset, temperature: 0 }
                    })}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                      adjustments.colorGrading.preset === preset
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                        : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={() => onApplyAdjustment('colorGrading')}
              disabled={isProcessing}
              className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('create.applyGrading', 'Apply Color Grading')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}