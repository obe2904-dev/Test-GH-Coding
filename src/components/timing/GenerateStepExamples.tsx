/**
 * EXAMPLE: Integrating Timing Context into GenerateStep
 * 
 * This file shows how to add soft timing hints to the manual post creation flow.
 * Copy the relevant parts into your actual GenerateStep.tsx component.
 */

import { useState } from 'react'
import { TimingContextBanner, useTimingContext } from '@/components/timing'

/**
 * OPTION 1: Always-Visible Banner (Recommended)
 * Shows timing context at the top of the editor
 */
export function GenerateStepWithBanner() {
  const { context, isLoading } = useTimingContext()
  
  return (
    <div className="generate-step">
      {/* Add timing context banner above editor */}
      {!isLoading && (
        <TimingContextBanner 
          context={context} 
          className="mb-4"
        />
      )}
      
      {/* Your existing editor components */}
      <div className="editor-pane">
        <textarea placeholder="Skriv dit indhold..." />
      </div>
    </div>
  )
}

/**
 * OPTION 2: Compact Inline Badge
 * Shows small badge next to topic input
 */
export function GenerateStepWithInlineBadge() {
  const { context } = useTimingContext()
  const [topic, setTopic] = useState('')
  
  return (
    <div className="generate-step">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Hvad handler dit opslag om?"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="flex-1"
        />
        
        {/* Compact timing badge */}
        <TimingContextBanner 
          context={context} 
          variant="compact"
        />
      </div>
      
      {/* Editor */}
    </div>
  )
}

/**
 * OPTION 3: Show When User Starts Typing
 * Only shows hint once user engages with the form
 */
export function GenerateStepWithConditionalHint() {
  const { context } = useTimingContext()
  const [topic, setTopic] = useState('')
  const [showHint, setShowHint] = useState(false)
  
  const handleTopicChange = (value: string) => {
    setTopic(value)
    if (value.length > 0 && !showHint) {
      setShowHint(true)
    }
  }
  
  return (
    <div className="generate-step">
      <input
        type="text"
        placeholder="Hvad handler dit opslag om?"
        value={topic}
        onChange={e => handleTopicChange(e.target.value)}
      />
      
      {/* Show timing hint after user starts typing */}
      {showHint && (
        <TimingContextBanner 
          context={context} 
          className="mt-3"
        />
      )}
      
      {/* Editor */}
    </div>
  )
}

/**
 * OPTION 4: Tooltip on Hover
 * Minimal - just shows tooltip when hovering info icon
 */
export function GenerateStepWithTooltip() {
  const { context } = useTimingContext()
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="generate-step">
      <div className="flex items-center gap-2 mb-4">
        <h2>Skriv dit opslag</h2>
        
        {/* Info icon with tooltip */}
        <div 
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute z-10 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200 top-full mt-2 left-0">
              <TimingContextBanner 
                context={context} 
                variant="tooltip"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Editor */}
    </div>
  )
}

/**
 * OPTION 5: Help Section in Sidebar
 * Shows timing strategy explanation in help panel
 */
export function GenerateStepWithHelpSection() {
  const [showHelp, setShowHelp] = useState(false)
  
  return (
    <div className="generate-step flex gap-6">
      {/* Main editor */}
      <div className="flex-1">
        <textarea placeholder="Skriv dit indhold..." />
      </div>
      
      {/* Sidebar with help */}
      <div className="w-64 space-y-4">
        <button 
          onClick={() => setShowHelp(!showHelp)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Hvordan virker tidstilpasning?
        </button>
        
        {showHelp && (
          <div className="bg-blue-50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Tidstilpasning</p>
            <p className="text-gray-700 mb-3">
              Din restaurant har naturlige kunde-mønstre gennem ugen.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="font-medium">Peak-tider</p>
                  <p className="text-gray-600 text-xs">
                    Målrettet til vennegrupper, familier
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">⚡</span>
                <div>
                  <p className="font-medium">Åbne tider</p>
                  <p className="text-gray-600 text-xs">
                    Bred appel: AYCE værdi, beliggenhed
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * RECOMMENDED IMPLEMENTATION
 * Combines banner + optional help tooltip
 */
export function GenerateStepRecommended() {
  const { context, isLoading } = useTimingContext()
  const [topic, setTopic] = useState('')
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  
  return (
    <div className="generate-step max-w-4xl mx-auto p-6">
      {/* Timing context banner - always visible */}
      <TimingContextBanner 
        context={context} 
        className="mb-6"
      />
      
      {/* Topic input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hvad handler dit opslag om?
        </label>
        <input
          type="text"
          placeholder="F.eks. Korean BBQ Selection"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Editor area */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Dit indhold
        </label>
        <textarea
          placeholder="Skriv eller generer med AI..."
          rows={8}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      {/* Generate button */}
      <button 
        disabled={!topic}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Generer med AI
      </button>
    </div>
  )
}
