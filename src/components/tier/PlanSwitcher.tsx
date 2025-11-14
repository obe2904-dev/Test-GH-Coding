// path: src/components/tier/PlanSwitcher.tsx
import { useEffect, useMemo, useState } from 'react'
import { useTierStore, type Tier } from '../../stores/tierStore'
import { supabase } from '../../lib/supabase'

/**
 * Why this shape:
 * - Your generated Database types don't include `profiles.plan` yet.
 * - We cast Supabase to `any` locally to bypass column inference until the DB/types are updated.
 * - When the column exists and types are regenerated, remove casts and use strict typing.
 */

type PlanSource = 'dev' | 'supabase'

interface PlanSwitcherProps {
  source?: PlanSource        // 'dev' for local override; switch to 'supabase' once profiles.plan exists
  writeBack?: boolean        // if true and source === 'supabase', attempt UPDATE profiles.plan on switch
  className?: string
}

const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  standardplus: 'StandardPlus',
  premium: 'Premium',
}

const STORAGE_KEY = 'dev:tier'

// Loose client to avoid TS errors while plan column isn't in types
const sbLoose: any = supabase

async function readPlanFromSupabase(): Promise<Tier | null> {
  try {
    const { data: sessionRes } = await sbLoose.auth.getSession()
    const userId: string | undefined = sessionRes?.session?.user?.id
    if (!userId) return null

    // Select only the needed field; tolerate absence
    const { data, error } = await sbLoose
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()

    if (error) return null
    const raw = (data?.plan ?? null) as string | null
    if (!raw) return null
    const normalized = raw.toLowerCase()
    return (['free', 'standardplus', 'premium'] as const).includes(normalized as any)
      ? (normalized as Tier)
      : null
  } catch {
    return null
  }
}

async function writePlanToSupabase(next: Tier): Promise<void> {
  try {
    const { data: sessionRes } = await sbLoose.auth.getSession()
    const userId: string | undefined = sessionRes?.session?.user?.id
    if (!userId) return

    // Soft-write; if the column doesn't exist yet, this will error and be swallowed.
    await sbLoose.from('profiles').update({ plan: next }).eq('id', userId)
  } catch {
    // dev-only: ignore
  }
}

export default function PlanSwitcher({ source = 'dev', writeBack = false, className = '' }: PlanSwitcherProps) {
  const { currentTier, setTier } = useTierStore((s) => ({ currentTier: s.currentTier, setTier: s.setTier }))
  const [loading, setLoading] = useState(source === 'supabase')

  // Initial sync: Supabase → store OR localStorage → store
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (source === 'supabase') {
        setLoading(true)
        const remote = await readPlanFromSupabase()
        if (mounted && remote) {
          setTier(remote)
          localStorage.setItem(STORAGE_KEY, remote)
        } else if (mounted) {
          const cached = localStorage.getItem(STORAGE_KEY) as Tier | null
          if (cached === 'free' || cached === 'standardplus' || cached === 'premium') {
            setTier(cached)
          }
        }
        setLoading(false)
      } else {
        const cached = localStorage.getItem(STORAGE_KEY) as Tier | null
        if (cached === 'free' || cached === 'standardplus' || cached === 'premium') {
          setTier(cached)
        }
      }
    })()
    return () => { mounted = false }
  }, [source, setTier])

  const buttons = useMemo(() => (['free','standardplus','premium'] as const), [])

  const handleSelect = async (next: Tier) => {
    setTier(next)
    localStorage.setItem(STORAGE_KEY, next)
    if (source === 'supabase' && writeBack) {
      await writePlanToSupabase(next)
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-slate-500">Plan</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
          {source === 'dev' ? 'DEV' : (loading ? 'Syncing…' : 'Supabase')}
        </span>
      </div>

      <div className="grid grid-cols-3 rounded-xl border border-slate-200 overflow-hidden">
        {buttons.map((key) => {
          const active = currentTier === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              className={[
                'px-3 py-1.5 text-sm transition-all',
                'focus:outline-none focus-visible:ring',
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
                'border-r last:border-r-0 border-slate-200',
              ].join(' ')}
              aria-pressed={active}
            >
              {TIER_LABELS[key]}
            </button>
          )
        })}
      </div>
    </div>
  )
}